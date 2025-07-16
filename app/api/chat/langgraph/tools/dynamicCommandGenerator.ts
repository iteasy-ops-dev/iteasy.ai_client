import { openai } from '@ai-sdk/openai'
import { generateText } from 'ai'

/**
 * 동적 명령어 생성 시스템 - Phase 1
 * 사용자 요청에 따라 OS별 맞춤형 명령어를 생성하는 시스템
 */

export interface CommandGenerationRequest {
  userRequest: string;           // 사용자 원본 요청
  osInfo: {                     // 대상 OS 정보
    type: 'windows' | 'linux' | 'macos' | 'unknown';
    version: string;
    shell: 'cmd' | 'powershell' | 'bash' | 'zsh' | 'unknown';
  };
  context: {                    // 컨텍스트 정보
    previousCommands: string[];   // 이전 실행 명령어들
    availableTools: string[];     // 설치된 도구들
    userPreferences: Record<string, any>;   // 사용자 선호도
  };
}

export interface GeneratedCommand {
  command: string;              // 실행할 명령어
  purpose: string;              // 명령어 목적 설명
  expectedOutput: string;       // 예상 출력 형태
  riskLevel: 'safe' | 'low' | 'medium' | 'high';
  timeout: number;              // 실행 타임아웃 (초)
  prerequisites: string[];      // 선행 조건
  category: string;             // 명령어 카테고리
}

export interface ValidationResult {
  valid: boolean;
  reason: string;
  suggestedAlternative?: string;
}

/**
 * OS별 기본 명령어 맵핑 시스템
 */
export const CommandMappings = {
  systemInfo: {
    windows: [
      { command: 'systeminfo', purpose: 'System information overview' },
      { command: 'wmic computersystem get model,name,manufacturer', purpose: 'Hardware details' },
      { command: 'wmic os get caption,version,buildnumber', purpose: 'OS version info' }
    ],
    linux: [
      { command: 'uname -a', purpose: 'System information' },
      { command: 'cat /etc/os-release', purpose: 'OS release info' },
      { command: 'hostnamectl status', purpose: 'System status' }
    ],
    macos: [
      { command: 'system_profiler SPHardwareDataType', purpose: 'Hardware information' },
      { command: 'sw_vers', purpose: 'Software version' },
      { command: 'uname -a', purpose: 'System information' }
    ]
  },
  memoryUsage: {
    windows: [
      { command: 'wmic OS get TotalVisibleMemorySize,FreePhysicalMemory', purpose: 'Memory statistics' },
      { command: 'systeminfo | findstr "Total Physical Memory"', purpose: 'Physical memory info' }
    ],
    linux: [
      { command: 'free -h', purpose: 'Memory usage in human readable format' },
      { command: 'cat /proc/meminfo', purpose: 'Detailed memory information' },
      { command: 'vmstat -s', purpose: 'Virtual memory statistics' }
    ],
    macos: [
      { command: 'vm_stat', purpose: 'Virtual memory statistics' },
      { command: 'top -l 1 -s 0 | grep PhysMem', purpose: 'Physical memory usage' }
    ]
  },
  cpuUsage: {
    windows: [
      { command: 'wmic cpu get loadpercentage', purpose: 'CPU load percentage' },
      { command: 'typeperf "\\Processor(_Total)\\% Processor Time" -sc 1', purpose: 'CPU usage via performance counter' }
    ],
    linux: [
      { command: 'top -bn1 | grep "Cpu(s)"', purpose: 'CPU usage from top' },
      { command: 'mpstat 1 1', purpose: 'CPU statistics' },
      { command: 'cat /proc/loadavg', purpose: 'System load average' }
    ],
    macos: [
      { command: 'top -l 1 | grep "CPU usage"', purpose: 'CPU usage from top' },
      { command: 'iostat -c 1', purpose: 'CPU statistics' }
    ]
  },
  diskUsage: {
    windows: [
      { command: 'wmic logicaldisk get size,freespace,caption', purpose: 'Disk space information' },
      { command: 'dir C:\\ /-c', purpose: 'Directory size information' }
    ],
    linux: [
      { command: 'df -h', purpose: 'Disk usage in human readable format' },
      { command: 'du -sh /*', purpose: 'Directory sizes' },
      { command: 'lsblk', purpose: 'Block device information' }
    ],
    macos: [
      { command: 'df -h', purpose: 'Disk usage' },
      { command: 'du -sh /*', purpose: 'Directory sizes' }
    ]
  },
  networkInfo: {
    windows: [
      { command: 'ipconfig /all', purpose: 'Network configuration' },
      { command: 'netstat -an', purpose: 'Network connections' }
    ],
    linux: [
      { command: 'ip addr show', purpose: 'Network interface information' },
      { command: 'ss -tuln', purpose: 'Network connections' },
      { command: 'netstat -i', purpose: 'Network interface statistics' }
    ],
    macos: [
      { command: 'ifconfig', purpose: 'Network interface configuration' },
      { command: 'netstat -rn', purpose: 'Routing table' }
    ]
  },
  processInfo: {
    windows: [
      { command: 'tasklist', purpose: 'Running processes' },
      { command: 'wmic process get name,processid,commandline', purpose: 'Detailed process information' }
    ],
    linux: [
      { command: 'ps aux', purpose: 'Running processes' },
      { command: 'ps -ef', purpose: 'Process tree' },
      { command: 'top -bn1', purpose: 'Process information with resource usage' }
    ],
    macos: [
      { command: 'ps aux', purpose: 'Running processes' },
      { command: 'top -l 1', purpose: 'Process information' }
    ]
  }
};

/**
 * 동적 명령어 생성기 클래스
 */
export class DynamicCommandGenerator {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * 사용자 요청을 분석하여 카테고리를 결정
   */
  private analyzeRequestCategory(userRequest: string): string {
    const lowerRequest = userRequest.toLowerCase();
    
    // 키워드 기반 카테고리 매칭
    const categoryKeywords = {
      systemInfo: ['시스템', '운영체제', 'os', 'system', 'info', 'information', '정보', '버전', 'version'],
      memoryUsage: ['메모리', 'memory', 'ram', '사용량', 'usage', '용량'],
      cpuUsage: ['cpu', 'processor', '프로세서', '사용률', 'usage', 'load', '로드'],
      diskUsage: ['디스크', 'disk', 'storage', '저장', '용량', 'space', '공간'],
      networkInfo: ['네트워크', 'network', 'ip', '인터페이스', 'interface', '연결'],
      processInfo: ['프로세스', 'process', 'task', 'service', '서비스', '실행']
    };

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => lowerRequest.includes(keyword))) {
        return category;
      }
    }

    return 'systemInfo'; // 기본값
  }

  /**
   * OS 정보를 감지하여 적절한 명령어 선택
   */
  private selectBaseCommands(
    category: string, 
    osType: 'windows' | 'linux' | 'macos' | 'unknown'
  ): Array<{command: string, purpose: string}> {
    const mapping = CommandMappings[category as keyof typeof CommandMappings];
    
    if (!mapping) {
      return [{ command: 'echo "Unknown category"', purpose: 'Fallback command' }];
    }

    // OS가 unknown인 경우 Linux 명령어를 기본으로 사용
    const validOsType = osType === 'unknown' ? 'linux' : osType;
    const osCommands = mapping[validOsType as keyof typeof mapping] || mapping.linux || [];
    
    return osCommands.slice(0, 3); // 최대 3개 명령어만 선택
  }

  /**
   * AI를 사용하여 맞춤형 명령어 생성
   */
  async generateOptimalCommands(
    request: CommandGenerationRequest
  ): Promise<GeneratedCommand[]> {
    console.log('🤖 [DYNAMIC_CMD] Starting AI-powered command generation');
    console.log(`📝 [DYNAMIC_CMD] User request: ${request.userRequest}`);
    console.log(`💻 [DYNAMIC_CMD] Target OS: ${request.osInfo.type} (${request.osInfo.shell})`);

    // 1. 카테고리 분석
    const category = this.analyzeRequestCategory(request.userRequest);
    console.log(`📂 [DYNAMIC_CMD] Detected category: ${category}`);

    // 2. 기본 명령어 선택
    const baseCommands = this.selectBaseCommands(category, request.osInfo.type);
    console.log(`🔧 [DYNAMIC_CMD] Base commands: ${baseCommands.map(c => c.command).join(', ')}`);

    // 3. AI 프롬프트 생성
    const aiPrompt = this.buildAIPrompt(request, category, baseCommands);
    
    try {
      // 4. AI 기반 명령어 생성
      const response = await generateText({
        model: openai('gpt-4'),
        prompt: aiPrompt,
        temperature: 0.3,
        maxTokens: 1000,
      });

      console.log(`🧠 [DYNAMIC_CMD] AI response received (${response.usage?.totalTokens} tokens)`);

      // 5. 응답 파싱
      const generatedCommands = this.parseAIResponse(response.text, category);
      console.log(`✅ [DYNAMIC_CMD] Generated ${generatedCommands.length} commands`);

      return generatedCommands;

    } catch (error) {
      console.error('❌ [DYNAMIC_CMD] AI generation failed:', error);
      
      // 6. 실패 시 기본 명령어 반환
      return this.createFallbackCommands(baseCommands, category, request.osInfo.type);
    }
  }

  /**
   * AI 프롬프트 생성
   */
  private buildAIPrompt(
    request: CommandGenerationRequest,
    category: string,
    baseCommands: Array<{command: string, purpose: string}>
  ): string {
    const osShellInfo = `${request.osInfo.type} ${request.osInfo.version} (${request.osInfo.shell})`;
    const baseCommandList = baseCommands.map(c => `- ${c.command}: ${c.purpose}`).join('\n');

    return `
사용자 요청: "${request.userRequest}"
대상 시스템: ${osShellInfo}
카테고리: ${category}

기본 명령어 옵션:
${baseCommandList}

다음 조건을 만족하는 명령어들을 JSON 배열로 생성해주세요:

1. 안전하고 읽기 전용인 명령어만 포함
2. ${request.osInfo.type} OS에 최적화된 네이티브 명령어 사용
3. 정보 수집 목적에 가장 적합한 명령어 선택
4. 실행 순서와 의존성 고려
5. 예상 실행 시간 10초 이내
6. 시스템에 무해한 명령어만 포함

응답은 반드시 다음 JSON 형식으로 제공해주세요:
[
  {
    "command": "실행할 명령어",
    "purpose": "명령어 목적 설명",
    "expectedOutput": "예상 출력 형태",
    "riskLevel": "safe",
    "timeout": 10,
    "prerequisites": ["선행 조건들"],
    "category": "${category}"
  }
]

중요: JSON 배열만 반환하고, 추가 설명은 포함하지 마세요.
`;
  }

  /**
   * AI 응답 파싱
   */
  private parseAIResponse(aiResponse: string, category: string): GeneratedCommand[] {
    try {
      // JSON 부분만 추출
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in AI response');
      }

      const parsedCommands = JSON.parse(jsonMatch[0]);
      
      // 유효성 검사 및 기본값 설정
      return parsedCommands.map((cmd: any) => ({
        command: cmd.command || '',
        purpose: cmd.purpose || 'Generated command',
        expectedOutput: cmd.expectedOutput || 'Command output',
        riskLevel: cmd.riskLevel || 'safe',
        timeout: Math.min(cmd.timeout || 10, 30), // 최대 30초 제한
        prerequisites: cmd.prerequisites || [],
        category: cmd.category || category
      })).filter((cmd: GeneratedCommand) => cmd.command.trim().length > 0);

    } catch (error) {
      console.error('❌ [DYNAMIC_CMD] Failed to parse AI response:', error);
      return [];
    }
  }

  /**
   * 폴백 명령어 생성
   */
  private createFallbackCommands(
    baseCommands: Array<{command: string, purpose: string}>,
    category: string,
    osType: string
  ): GeneratedCommand[] {
    console.log('🔄 [DYNAMIC_CMD] Creating fallback commands');
    
    return baseCommands.map(cmd => ({
      command: cmd.command,
      purpose: cmd.purpose,
      expectedOutput: 'System information output',
      riskLevel: 'safe' as const,
      timeout: 10,
      prerequisites: [],
      category: category
    }));
  }

  /**
   * 간단한 명령어 생성 (AI 없이)
   */
  generateSimpleCommands(
    request: CommandGenerationRequest
  ): GeneratedCommand[] {
    console.log('⚡ [DYNAMIC_CMD] Generating simple commands without AI');
    
    const category = this.analyzeRequestCategory(request.userRequest);
    const baseCommands = this.selectBaseCommands(category, request.osInfo.type);
    
    return this.createFallbackCommands(baseCommands, category, request.osInfo.type);
  }
}

/**
 * 기본 명령어 생성 함수 (외부 사용)
 */
export async function generateDynamicCommands(
  request: CommandGenerationRequest,
  apiKey: string,
  useAI: boolean = true
): Promise<GeneratedCommand[]> {
  const generator = new DynamicCommandGenerator(apiKey);
  
  if (useAI) {
    return await generator.generateOptimalCommands(request);
  } else {
    return generator.generateSimpleCommands(request);
  }
}