import { GeneratedCommand, ValidationResult } from './dynamicCommandGenerator'
import { CommandSecurityValidator } from './commandSecurityValidator'
import { SSHConnectionInfo } from '../types'

// Node SSH를 동적으로 가져와서 서버 사이드에서만 실행되도록 함
let NodeSSH: any = null;
async function getNodeSSH() {
  if (!NodeSSH) {
    NodeSSH = (await import('node-ssh')).NodeSSH;
  }
  return NodeSSH;
}

/**
 * 동적 명령어 실행 시스템
 * 생성된 명령어들을 안전하게 실행하고 결과를 수집
 */

export interface ExecutionResult {
  command: string;
  success: boolean;
  result?: any;
  error?: string;
  executionTime: number;
  output?: string;
  stderr?: string;
  exitCode?: number;
  timestamp: Date;
  riskLevel: string;
  category: string;
}

export interface ExecutionContext {
  sshConnection: SSHConnectionInfo;
  apiKey: string;
  useAI: boolean;
  maxConcurrency: number;
  globalTimeout: number;
}

export class DynamicCommandExecutor {
  private validator: CommandSecurityValidator;
  private executionHistory: ExecutionResult[] = [];
  private maxHistorySize = 100;

  constructor(apiKey: string) {
    this.validator = new CommandSecurityValidator(apiKey);
  }

  /**
   * 명령어 시퀀스 실행 메인 함수
   */
  async executeCommandSequence(
    commands: GeneratedCommand[],
    context: ExecutionContext
  ): Promise<ExecutionResult[]> {
    console.log(`🚀 [EXEC] Starting execution of ${commands.length} commands`);
    console.log(`🔐 [EXEC] Target: ${context.sshConnection.username}@${context.sshConnection.host}:${context.sshConnection.port}`);

    const results: ExecutionResult[] = [];
    const startTime = Date.now();

    // SSH 연결 설정
    const NodeSSHClass = await getNodeSSH();
    const ssh = new NodeSSHClass();
    let sshConnected = false;

    try {
      // SSH 연결 시도
      await ssh.connect({
        host: context.sshConnection.host,
        port: context.sshConnection.port,
        username: context.sshConnection.username,
        password: context.sshConnection.password,
        // 추가 SSH 옵션
        readyTimeout: 30000,
        algorithms: {
          kex: ['diffie-hellman-group1-sha1', 'diffie-hellman-group14-sha1', 'diffie-hellman-group-exchange-sha1', 'diffie-hellman-group-exchange-sha256'],
          cipher: ['aes128-ctr', 'aes192-ctr', 'aes256-ctr', 'aes128-gcm', 'aes256-gcm'],
          serverHostKey: ['ssh-rsa', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521'],
          hmac: ['hmac-sha2-256', 'hmac-sha2-512', 'hmac-sha1']
        }
      });
      
      sshConnected = true;
      console.log(`✅ [EXEC] SSH connection established`);

      // 병렬 실행 제한
      const concurrency = Math.min(commands.length, context.maxConcurrency || 3);
      const batches = this.createBatches(commands, concurrency);

      for (const batch of batches) {
        const batchResults = await Promise.all(
          batch.map(cmd => this.executeCommand(cmd, ssh, context))
        );
        results.push(...batchResults);
      }

    } catch (error) {
      console.error(`❌ [EXEC] SSH connection failed:`, error);
      
      // 연결 실패 시 모든 명령어를 실패로 처리
      return commands.map(cmd => ({
        command: cmd.command,
        success: false,
        error: `SSH connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        executionTime: 0,
        timestamp: new Date(),
        riskLevel: cmd.riskLevel,
        category: cmd.category
      }));
    } finally {
      if (sshConnected) {
        ssh.dispose();
        console.log(`🔐 [EXEC] SSH connection closed`);
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`🏁 [EXEC] Execution completed in ${totalTime}ms`);
    console.log(`📊 [EXEC] Results: ${results.filter(r => r.success).length}/${results.length} successful`);

    // 실행 기록 저장
    this.saveExecutionHistory(results);

    return results;
  }

  /**
   * 개별 명령어 실행
   */
  private async executeCommand(
    cmd: GeneratedCommand,
    ssh: any,
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const timestamp = new Date();
    
    console.log(`🔧 [EXEC] Executing: ${cmd.command}`);

    try {
      // 1. 보안 검증
      const validation = await this.validator.validateCommand(cmd);
      if (!validation.valid) {
        console.log(`❌ [EXEC] Security validation failed: ${validation.reason}`);
        return {
          command: cmd.command,
          success: false,
          error: `Security validation failed: ${validation.reason}`,
          executionTime: Date.now() - startTime,
          timestamp,
          riskLevel: cmd.riskLevel,
          category: cmd.category
        };
      }

      // 2. 명령어 실행
      const execResult = await ssh.execCommand(cmd.command, {
        cwd: '/',
        execOptions: {
          timeout: (cmd.timeout || 30) * 1000,
          env: {
            LANG: 'en_US.UTF-8',
            LC_ALL: 'en_US.UTF-8'
          }
        }
      });

      const executionTime = Date.now() - startTime;
      const isSuccess = execResult.code === 0;

      // 3. 결과 파싱
      const parsedResult = await this.parseCommandOutput(cmd, execResult, executionTime);

      console.log(`${isSuccess ? '✅' : '❌'} [EXEC] Command ${isSuccess ? 'succeeded' : 'failed'} in ${executionTime}ms`);

      // 4. 성공 패턴 학습 (향후 구현)
      if (isSuccess) {
        await this.recordSuccess(cmd, parsedResult);
      }

      return {
        command: cmd.command,
        success: isSuccess,
        result: parsedResult,
        output: execResult.stdout,
        stderr: execResult.stderr,
        exitCode: execResult.code,
        executionTime,
        timestamp,
        riskLevel: cmd.riskLevel,
        category: cmd.category
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error(`❌ [EXEC] Command execution failed: ${errorMessage}`);
      
      return {
        command: cmd.command,
        success: false,
        error: errorMessage,
        executionTime,
        timestamp,
        riskLevel: cmd.riskLevel,
        category: cmd.category
      };
    }
  }

  /**
   * 명령어 결과 파싱 및 구조화
   */
  private async parseCommandOutput(
    cmd: GeneratedCommand,
    execResult: { stdout: string; stderr: string; code: number },
    executionTime: number
  ): Promise<any> {
    const { stdout, stderr, code } = execResult;
    
    // 기본 결과 구조
    const baseResult = {
      command: cmd.command,
      category: cmd.category,
      executionTime,
      exitCode: code,
      rawOutput: stdout,
      rawError: stderr
    };

    // 카테고리별 특화 파싱
    try {
      switch (cmd.category) {
        case 'systemInfo':
          return this.parseSystemInfo(stdout, baseResult);
        case 'memoryUsage':
          return this.parseMemoryUsage(stdout, baseResult);
        case 'cpuUsage':
          return this.parseCpuUsage(stdout, baseResult);
        case 'diskUsage':
          return this.parseDiskUsage(stdout, baseResult);
        case 'networkInfo':
          return this.parseNetworkInfo(stdout, baseResult);
        case 'processInfo':
          return this.parseProcessInfo(stdout, baseResult);
        default:
          return { ...baseResult, parsed: 'raw_output' };
      }
    } catch (parseError) {
      console.warn(`⚠️ [EXEC] Parse error for ${cmd.category}:`, parseError);
      return { ...baseResult, parsed: 'parse_failed', parseError: parseError instanceof Error ? parseError.message : 'Unknown parse error' };
    }
  }

  /**
   * 시스템 정보 파싱
   */
  private parseSystemInfo(output: string, baseResult: any): any {
    const lines = output.split('\n');
    const info: any = { ...baseResult };

    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.includes('OS Name:') || trimmed.includes('System:')) {
        info.osName = trimmed.split(':')[1]?.trim();
      }
      if (trimmed.includes('Version:') || trimmed.includes('Release:')) {
        info.version = trimmed.split(':')[1]?.trim();
      }
      if (trimmed.includes('System Type:') || trimmed.includes('Architecture:')) {
        info.architecture = trimmed.split(':')[1]?.trim();
      }
      if (trimmed.includes('Host Name:') || trimmed.includes('hostname')) {
        info.hostname = trimmed.split(':')[1]?.trim();
      }
    });

    return info;
  }

  /**
   * 메모리 사용량 파싱
   */
  private parseMemoryUsage(output: string, baseResult: any): any {
    const lines = output.split('\n');
    const memory: any = { ...baseResult };

    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.includes('Mem:')) {
        const parts = trimmed.split(/\s+/);
        memory.total = parts[1];
        memory.used = parts[2];
        memory.free = parts[3];
      }
      if (trimmed.includes('MemTotal:')) {
        memory.totalKb = trimmed.split(':')[1]?.trim();
      }
      if (trimmed.includes('MemFree:')) {
        memory.freeKb = trimmed.split(':')[1]?.trim();
      }
    });

    return memory;
  }

  /**
   * CPU 사용량 파싱
   */
  private parseCpuUsage(output: string, baseResult: any): any {
    const lines = output.split('\n');
    const cpu: any = { ...baseResult };

    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.includes('Cpu(s):')) {
        const match = trimmed.match(/(\d+\.\d+)%\s*us/);
        if (match) cpu.userCpu = match[1];
      }
      if (trimmed.includes('LoadPercentage')) {
        cpu.loadPercentage = trimmed.split('=')[1]?.trim();
      }
    });

    return cpu;
  }

  /**
   * 디스크 사용량 파싱
   */
  private parseDiskUsage(output: string, baseResult: any): any {
    const lines = output.split('\n');
    const disks: any = { ...baseResult, filesystems: [] };

    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.includes('/dev/') || trimmed.includes('C:')) {
        const parts = trimmed.split(/\s+/);
        if (parts.length >= 4) {
          disks.filesystems.push({
            filesystem: parts[0],
            size: parts[1],
            used: parts[2],
            available: parts[3],
            usePercent: parts[4],
            mountPoint: parts[5]
          });
        }
      }
    });

    return disks;
  }

  /**
   * 네트워크 정보 파싱
   */
  private parseNetworkInfo(output: string, baseResult: any): any {
    const lines = output.split('\n');
    const network: any = { ...baseResult, interfaces: [] };

    let currentInterface: any = null;

    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.includes('eth') || trimmed.includes('en') || trimmed.includes('wlan')) {
        if (currentInterface) {
          network.interfaces.push(currentInterface);
        }
        currentInterface = { name: trimmed.split(':')[0] };
      }
      if (currentInterface && trimmed.includes('inet ')) {
        const match = trimmed.match(/inet (\d+\.\d+\.\d+\.\d+)/);
        if (match) currentInterface.ip = match[1];
      }
    });

    if (currentInterface) {
      network.interfaces.push(currentInterface);
    }

    return network;
  }

  /**
   * 프로세스 정보 파싱
   */
  private parseProcessInfo(output: string, baseResult: any): any {
    const lines = output.split('\n');
    const processes: any = { ...baseResult, processes: [] };

    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('PID') && !trimmed.startsWith('USER')) {
        const parts = trimmed.split(/\s+/);
        if (parts.length >= 4) {
          processes.processes.push({
            pid: parts[1],
            cpu: parts[2],
            mem: parts[3],
            command: parts.slice(10).join(' ')
          });
        }
      }
    });

    return processes;
  }

  /**
   * 명령어 배치 생성
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * 성공 패턴 기록 (향후 학습 시스템용)
   */
  private async recordSuccess(cmd: GeneratedCommand, result: any): Promise<void> {
    // 향후 구현: 성공한 명령어 패턴을 데이터베이스에 저장
    console.log(`📚 [LEARN] Recording success pattern for: ${cmd.command}`);
  }

  /**
   * 실행 기록 저장
   */
  private saveExecutionHistory(results: ExecutionResult[]): void {
    this.executionHistory.push(...results);
    
    // 기록 크기 제한
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory = this.executionHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * 실행 기록 조회
   */
  getExecutionHistory(): ExecutionResult[] {
    return [...this.executionHistory];
  }

  /**
   * 통계 정보 조회
   */
  getExecutionStats(): {
    totalExecutions: number;
    successRate: number;
    averageExecutionTime: number;
    categoryStats: Record<string, { count: number; successRate: number }>;
  } {
    const total = this.executionHistory.length;
    const successful = this.executionHistory.filter(r => r.success).length;
    const avgTime = this.executionHistory.reduce((sum, r) => sum + r.executionTime, 0) / total;

    const categoryStats: Record<string, { count: number; successRate: number }> = {};
    this.executionHistory.forEach(result => {
      if (!categoryStats[result.category]) {
        categoryStats[result.category] = { count: 0, successRate: 0 };
      }
      categoryStats[result.category].count++;
      if (result.success) {
        categoryStats[result.category].successRate++;
      }
    });

    // 성공률 계산
    Object.values(categoryStats).forEach(stats => {
      stats.successRate = stats.successRate / stats.count;
    });

    return {
      totalExecutions: total,
      successRate: successful / total,
      averageExecutionTime: avgTime,
      categoryStats
    };
  }
}

/**
 * 외부 사용을 위한 간편 함수
 */
export async function executeDynamicCommands(
  commands: GeneratedCommand[],
  context: ExecutionContext
): Promise<ExecutionResult[]> {
  const executor = new DynamicCommandExecutor(context.apiKey);
  return await executor.executeCommandSequence(commands, context);
}