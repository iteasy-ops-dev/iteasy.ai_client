import { openai } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { GeneratedCommand, ValidationResult } from './dynamicCommandGenerator'

/**
 * 명령어 보안 검증 시스템
 * 다층 보안 체계를 통해 위험한 명령어를 필터링
 */

export interface SecurityAssessment {
  score: number;        // 0-1 사이의 위험도 점수
  reasoning: string;    // 평가 이유
  concerns: string[];   // 주요 우려사항
}

export class CommandSecurityValidator {
  private apiKey: string;

  // 위험한 명령어 블랙리스트
  private readonly blacklistedCommands = [
    // 시스템 제어
    'shutdown', 'reboot', 'halt', 'poweroff', 'restart',
    
    // 파일 시스템 위험
    'rm -rf', 'del /f', 'del /q', 'format', 'fdisk', 'mkfs',
    'dd if=', 'truncate', 'shred',
    
    // 네트워크 보안
    'wget', 'curl', 'nc', 'netcat', 'telnet', 'ssh', 'scp', 'rsync',
    'nmap', 'ping -f', 'hping',
    
    // 권한 관리
    'passwd', 'sudo', 'su', 'chmod 777', 'chown', 'usermod',
    'net user', 'net localgroup',
    
    // 프로세스 제어
    'kill -9', 'killall', 'taskkill /f',
    
    // 패키지 관리
    'apt install', 'yum install', 'dnf install', 'pip install',
    'npm install', 'gem install',
    
    // 서비스 제어
    'systemctl start', 'systemctl stop', 'systemctl restart',
    'service start', 'service stop', 'service restart',
    'net start', 'net stop',
    
    // 레지스트리 및 구성
    'reg add', 'reg delete', 'regedit',
    
    // 압축 및 아카이브
    'tar -xf', 'unzip', 'gunzip'
  ];

  // 위험한 패턴 정규표현식
  private readonly dangerousPatterns = [
    />\s*\/dev\/null/,              // 출력 리다이렉션
    /\|\s*sh/,                      // 파이프를 통한 쉘 실행
    /\|\s*bash/,                    // 파이프를 통한 bash 실행
    /\|\s*cmd/,                     // 파이프를 통한 cmd 실행
    /&&|;(?!\s*$)/,                 // 명령어 체이닝 (끝이 아닌 경우)
    /\$\(/,                         // 명령어 치환
    /`[^`]+`/,                      // 백틱 명령어 치환
    /\|\s*xargs/,                   // xargs를 통한 명령어 실행
    /\|\s*while\s+read/,            // while 루프와 명령어 실행
    />\s*[^>\s]/,                   // 파일 덮어쓰기
    />>\s*[^>\s]/,                  // 파일 추가 쓰기
    /<\s*[^<\s]/,                   // 파일 입력 리다이렉션
    /\|\s*tee/,                     // tee를 통한 파일 쓰기
    /eval\s+/,                      // eval 명령어
    /exec\s+/,                      // exec 명령어
    /\$\{[^}]+\}/,                  // 변수 치환
    /\*\s*\*/,                      // 와일드카드 조합
    /\.\.\//,                       // 디렉토리 이동
    /\/\*$/,                        // 루트 디렉토리 와일드카드
  ];

  // 안전한 읽기 전용 명령어 화이트리스트
  private readonly safeCommands = [
    // 시스템 정보
    'systeminfo', 'uname', 'hostnamectl', 'sw_vers', 'system_profiler',
    'cat /etc/os-release', 'cat /proc/version', 'lsb_release',
    
    // 하드웨어 정보
    'lscpu', 'lshw', 'dmidecode', 'hwinfo', 'inxi',
    
    // 메모리 정보
    'free', 'vmstat', 'cat /proc/meminfo', 'vm_stat',
    
    // 디스크 정보
    'df', 'du', 'lsblk', 'fdisk -l', 'diskutil',
    
    // 네트워크 정보 (읽기 전용)
    'ip addr', 'ip route', 'ifconfig', 'netstat', 'ss',
    'ipconfig', 'route print', 'arp -a',
    
    // 프로세스 정보
    'ps', 'top', 'htop', 'tasklist', 'pgrep',
    
    // 파일 시스템 (읽기 전용)
    'ls', 'dir', 'find', 'locate', 'which', 'whereis',
    'cat', 'head', 'tail', 'less', 'more', 'type',
    
    // 로그 파일
    'journalctl', 'dmesg', 'tail /var/log', 'cat /var/log',
    
    // 성능 모니터링
    'iostat', 'mpstat', 'sar', 'nmon', 'glances',
    
    // Windows 관련
    'wmic', 'typeperf', 'perfmon', 'msinfo32',
    
    // 네트워크 테스트 (기본)
    'ping', 'traceroute', 'tracert', 'nslookup', 'dig'
  ];

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * 명령어 보안 검증 메인 함수
   */
  async validateCommand(cmd: GeneratedCommand): Promise<ValidationResult> {
    console.log(`🔒 [SECURITY] Validating command: ${cmd.command}`);

    // 1. 블랙리스트 검사
    const blacklistResult = this.checkBlacklist(cmd.command);
    if (!blacklistResult.valid) {
      console.log(`❌ [SECURITY] Blacklisted: ${blacklistResult.reason}`);
      return blacklistResult;
    }

    // 2. 위험 패턴 검사
    const patternResult = this.checkDangerousPatterns(cmd.command);
    if (!patternResult.valid) {
      console.log(`❌ [SECURITY] Dangerous pattern: ${patternResult.reason}`);
      return patternResult;
    }

    // 3. 화이트리스트 검사
    const whitelistResult = this.checkWhitelist(cmd.command);
    if (whitelistResult.valid) {
      console.log(`✅ [SECURITY] Whitelisted command approved`);
      return whitelistResult;
    }

    // 4. 기본 안전성 검사
    const basicSafetyResult = this.checkBasicSafety(cmd.command);
    if (!basicSafetyResult.valid) {
      console.log(`❌ [SECURITY] Basic safety failed: ${basicSafetyResult.reason}`);
      return basicSafetyResult;
    }

    // 5. AI 기반 위험도 평가 (선택적)
    if (cmd.riskLevel !== 'safe') {
      const aiResult = await this.assessRiskWithAI(cmd);
      if (!aiResult.valid) {
        console.log(`❌ [SECURITY] AI assessment failed: ${aiResult.reason}`);
        return aiResult;
      }
    }

    console.log(`✅ [SECURITY] Command passed all security checks`);
    return { valid: true, reason: 'Command passed all security checks' };
  }

  /**
   * 블랙리스트 검사
   */
  private checkBlacklist(command: string): ValidationResult {
    const lowerCommand = command.toLowerCase();
    
    for (const blacklisted of this.blacklistedCommands) {
      if (lowerCommand.includes(blacklisted.toLowerCase())) {
        return {
          valid: false,
          reason: `Blacklisted command detected: ${blacklisted}`,
          suggestedAlternative: this.suggestAlternative(blacklisted)
        };
      }
    }
    
    return { valid: true, reason: 'No blacklisted commands found' };
  }

  /**
   * 위험 패턴 검사
   */
  private checkDangerousPatterns(command: string): ValidationResult {
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(command)) {
        return {
          valid: false,
          reason: `Dangerous pattern detected: ${pattern.source}`,
          suggestedAlternative: 'Use simple command without pipes or redirections'
        };
      }
    }
    
    return { valid: true, reason: 'No dangerous patterns found' };
  }

  /**
   * 화이트리스트 검사
   */
  private checkWhitelist(command: string): ValidationResult {
    const commandStart = command.trim().split(' ')[0].toLowerCase();
    
    for (const safeCmd of this.safeCommands) {
      if (safeCmd.toLowerCase().startsWith(commandStart) || 
          commandStart.startsWith(safeCmd.toLowerCase())) {
        return { valid: true, reason: 'Command found in whitelist' };
      }
    }
    
    return { valid: false, reason: 'Command not in whitelist' };
  }

  /**
   * 기본 안전성 검사
   */
  private checkBasicSafety(command: string): ValidationResult {
    const trimmed = command.trim();
    
    // 빈 명령어
    if (trimmed.length === 0) {
      return { valid: false, reason: 'Empty command' };
    }
    
    // 너무 긴 명령어
    if (trimmed.length > 500) {
      return { valid: false, reason: 'Command too long' };
    }
    
    // 의심스러운 문자 조합
    if (trimmed.includes('$(') || trimmed.includes('`') || trimmed.includes('${')) {
      return { valid: false, reason: 'Command substitution detected' };
    }
    
    // 여러 명령어 체이닝
    if (trimmed.includes('&&') || trimmed.includes('||') || /;\s*\w/.test(trimmed)) {
      return { valid: false, reason: 'Command chaining detected' };
    }
    
    return { valid: true, reason: 'Basic safety checks passed' };
  }

  /**
   * AI 기반 위험도 평가
   */
  private async assessRiskWithAI(cmd: GeneratedCommand): Promise<ValidationResult> {
    try {
      const prompt = `
명령어 보안 분석 요청:
명령어: "${cmd.command}"
목적: "${cmd.purpose}"
카테고리: "${cmd.category}"

다음 관점에서 이 명령어의 위험도를 평가해주세요:
1. 시스템 파일 변경 가능성
2. 네트워크 보안 위험
3. 권한 상승 위험
4. 데이터 유출 위험
5. 시스템 안정성 위험

0-1 사이의 위험도 점수와 평가 이유를 JSON 형식으로 반환해주세요:
{
  "score": 0.0,
  "reasoning": "평가 이유",
  "concerns": ["우려사항1", "우려사항2"]
}

점수 기준:
- 0.0-0.3: 안전 (읽기 전용 명령어)
- 0.4-0.6: 낮은 위험 (시스템 정보 변경 가능)
- 0.7-0.8: 중간 위험 (중요 설정 변경 가능)
- 0.9-1.0: 높은 위험 (시스템 손상 가능)
`;

      const response = await generateText({
        model: openai('gpt-4'),
        prompt,
        temperature: 0.1,
        maxTokens: 300,
      });

      const assessment = this.parseSecurityAssessment(response.text);
      
      if (assessment.score > 0.7) {
        return {
          valid: false,
          reason: `High risk score (${assessment.score.toFixed(2)}): ${assessment.reasoning}`,
          suggestedAlternative: 'Use a safer alternative command'
        };
      }
      
      return { valid: true, reason: `Low risk score (${assessment.score.toFixed(2)})` };
      
    } catch (error) {
      console.error('❌ [SECURITY] AI assessment failed:', error);
      // AI 평가 실패 시 보수적으로 차단
      return { valid: false, reason: 'AI security assessment failed' };
    }
  }

  /**
   * AI 보안 평가 결과 파싱
   */
  private parseSecurityAssessment(aiResponse: string): SecurityAssessment {
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          score: Math.min(Math.max(parsed.score || 0.5, 0), 1),
          reasoning: parsed.reasoning || 'No reasoning provided',
          concerns: parsed.concerns || []
        };
      }
    } catch (error) {
      console.error('❌ [SECURITY] Failed to parse AI assessment:', error);
    }
    
    // 파싱 실패 시 중간 위험도로 설정
    return {
      score: 0.5,
      reasoning: 'Failed to parse AI assessment',
      concerns: ['Assessment parsing failed']
    };
  }

  /**
   * 대안 명령어 제안
   */
  private suggestAlternative(blacklistedCommand: string): string {
    const alternatives: Record<string, string> = {
      'rm -rf': 'ls -la (to view files instead of deleting)',
      'del /f': 'dir (to view files instead of deleting)',
      'shutdown': 'systemctl status (to check system status)',
      'reboot': 'uptime (to check system uptime)',
      'wget': 'curl --head (to check URL without downloading)',
      'curl': 'ping (to test connectivity)',
      'sudo': 'whoami (to check current user)',
      'chmod 777': 'ls -la (to view current permissions)',
      'passwd': 'whoami (to check current user)',
      'systemctl start': 'systemctl status (to check service status)',
      'service start': 'service status (to check service status)',
      'kill -9': 'ps aux (to view running processes)',
      'taskkill /f': 'tasklist (to view running processes)'
    };
    
    return alternatives[blacklistedCommand] || 'Use a safer read-only command';
  }

  /**
   * 간단한 명령어 검증 (AI 없이)
   */
  validateSimpleCommand(command: string): ValidationResult {
    // 기본 검증만 수행
    const blacklistResult = this.checkBlacklist(command);
    if (!blacklistResult.valid) return blacklistResult;
    
    const patternResult = this.checkDangerousPatterns(command);
    if (!patternResult.valid) return patternResult;
    
    const basicSafetyResult = this.checkBasicSafety(command);
    if (!basicSafetyResult.valid) return basicSafetyResult;
    
    return { valid: true, reason: 'Simple validation passed' };
  }
}

/**
 * 외부 사용을 위한 간단한 검증 함수
 */
export async function validateCommandSecurity(
  cmd: GeneratedCommand,
  apiKey: string,
  useAI: boolean = false
): Promise<ValidationResult> {
  const validator = new CommandSecurityValidator(apiKey);
  
  if (useAI) {
    return await validator.validateCommand(cmd);
  } else {
    return validator.validateSimpleCommand(cmd.command);
  }
}