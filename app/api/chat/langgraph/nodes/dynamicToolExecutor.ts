import { ChatState, NodeResponse, SSHConnectionInfo } from '../types'
import { 
  generateDynamicCommands, 
  CommandGenerationRequest, 
  GeneratedCommand 
} from '../tools/dynamicCommandGenerator'
import { 
  executeDynamicCommands, 
  ExecutionContext, 
  ExecutionResult 
} from '../tools/dynamicCommandExecutor'

/**
 * 동적 도구 실행 노드
 * 기존 정적 도구 시스템과 새로운 동적 명령어 시스템을 통합
 */

export async function dynamicToolExecutorNode(
  state: ChatState,
  config: { apiKey: string; model?: string }
): Promise<NodeResponse> {
  console.log('=== Dynamic Tool Executor Node ===');
  console.log('🔄 Starting dynamic command generation and execution');
  console.log(`📝 User request: ${state.lastUserMessage}`);
  console.log(`🔗 SSH connection: ${state.sshConnection ? 'Available' : 'Not available'}`);

  try {
    // 1. SSH 연결 확인
    if (!state.sshConnection) {
      console.log('❌ [DYNAMIC] No SSH connection available');
      return {
        response: '원격 서버 연결 정보가 없습니다. SSH 연결 정보를 제공해주세요.',
        toolExecutionResults: [{
          success: false,
          result: null,
          error: 'No SSH connection available',
          executionTime: 0
        }]
      };
    }

    // 2. OS 정보 추출 (기존 연결에서 또는 추정)
    const osInfo = await detectOSInfo(state.sshConnection, config.apiKey);
    console.log(`💻 [DYNAMIC] Detected OS: ${osInfo.type} (${osInfo.shell})`);

    // 3. 명령어 생성 요청 준비
    const commandRequest: CommandGenerationRequest = {
      userRequest: state.lastUserMessage,
      osInfo: osInfo,
      context: {
        previousCommands: state.toolExecutionResults?.map(r => r.result?.command || '') || [],
        availableTools: [], // 향후 구현
        userPreferences: {} // 향후 구현
      }
    };

    // 4. 동적 명령어 생성
    console.log('🧠 [DYNAMIC] Generating dynamic commands...');
    const generatedCommands = await generateDynamicCommands(
      commandRequest,
      config.apiKey,
      true // AI 사용
    );

    console.log(`📦 [DYNAMIC] Generated ${generatedCommands.length} commands`);
    generatedCommands.forEach((cmd, index) => {
      console.log(`  ${index + 1}. ${cmd.command} (${cmd.purpose})`);
    });

    // 5. 명령어 실행 컨텍스트 설정
    const executionContext: ExecutionContext = {
      sshConnection: state.sshConnection,
      apiKey: config.apiKey,
      useAI: true,
      maxConcurrency: 3,
      globalTimeout: 60000 // 60초
    };

    // 6. 명령어 실행
    console.log('⚡ [DYNAMIC] Executing commands...');
    const executionResults = await executeDynamicCommands(
      generatedCommands,
      executionContext
    );

    // 7. 결과 분석 및 요약
    const summary = analyzeExecutionResults(executionResults);
    console.log(`📊 [DYNAMIC] Execution summary: ${summary.successCount}/${summary.totalCount} successful`);

    // 8. 응답 생성
    const response = await generateResponseFromResults(
      state.lastUserMessage,
      executionResults,
      summary,
      config.apiKey
    );

    return {
      response: response,
      toolExecutionResults: executionResults.map(convertToToolResult),
      selectedTools: generatedCommands.map(cmd => cmd.category),
      sshConnection: state.sshConnection // SSH 연결 정보 유지
    };

  } catch (error) {
    console.error('❌ [DYNAMIC] Dynamic tool execution failed:', error);
    
    return {
      response: '동적 명령어 실행 중 오류가 발생했습니다. 다시 시도해주세요.',
      toolExecutionResults: [{
        success: false,
        result: null,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: 0
      }]
    };
  }
}

/**
 * OS 정보 탐지
 */
async function detectOSInfo(
  sshConnection: SSHConnectionInfo,
  apiKey: string
): Promise<{
  type: 'windows' | 'linux' | 'macos' | 'unknown';
  version: string;
  shell: 'cmd' | 'powershell' | 'bash' | 'zsh' | 'unknown';
}> {
  // 기본값 설정
  const defaultInfo = {
    type: 'linux' as const,
    version: 'unknown',
    shell: 'bash' as const
  };

  try {
    // SSH 포트 기반 추정 (일반적인 패턴)
    if (sshConnection.port === 22) {
      return { ...defaultInfo, type: 'linux' };
    }

    // 향후 구현: 실제 OS 탐지 명령어 실행
    // const osDetectCommand = { command: 'uname -s', purpose: 'Detect OS', ... };
    // const result = await executeCommand(osDetectCommand, sshConnection);
    
    return defaultInfo;
  } catch (error) {
    console.warn('⚠️ [DYNAMIC] OS detection failed, using defaults:', error);
    return defaultInfo;
  }
}

/**
 * 실행 결과 분석
 */
function analyzeExecutionResults(results: ExecutionResult[]): {
  totalCount: number;
  successCount: number;
  failureCount: number;
  averageExecutionTime: number;
  categories: string[];
  errors: string[];
} {
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.length - successCount;
  const averageTime = results.reduce((sum, r) => sum + r.executionTime, 0) / results.length;
  const categories = [...new Set(results.map(r => r.category))];
  const errors = results.filter(r => !r.success).map(r => r.error || 'Unknown error');

  return {
    totalCount: results.length,
    successCount,
    failureCount,
    averageExecutionTime: averageTime,
    categories,
    errors
  };
}

/**
 * 실행 결과를 바탕으로 응답 생성
 */
async function generateResponseFromResults(
  userRequest: string,
  results: ExecutionResult[],
  summary: any,
  apiKey: string
): Promise<string> {
  console.log('📝 [DYNAMIC] Generating response from execution results');

  // 성공한 결과만 필터링
  const successfulResults = results.filter(r => r.success);

  if (successfulResults.length === 0) {
    return `요청하신 "${userRequest}"에 대한 정보를 수집하지 못했습니다.\n\n실행 오류:\n${summary.errors.slice(0, 3).map((e: string) => `• ${e}`).join('\n')}`;
  }

  // 카테고리별 결과 정리
  const categoryResults: Record<string, ExecutionResult[]> = {};
  successfulResults.forEach(result => {
    if (!categoryResults[result.category]) {
      categoryResults[result.category] = [];
    }
    categoryResults[result.category].push(result);
  });

  // 응답 생성
  let response = `"${userRequest}"에 대한 정보를 수집했습니다.\n\n`;

  // 카테고리별 결과 표시
  Object.entries(categoryResults).forEach(([category, categoryResults]) => {
    response += `## ${getCategoryDisplayName(category)}\n`;
    
    categoryResults.forEach((result, index) => {
      if (result.result && typeof result.result === 'object') {
        response += formatResultData(result.result, category);
      } else if (result.output) {
        response += `\`\`\`\n${result.output.slice(0, 500)}${result.output.length > 500 ? '...' : ''}\n\`\`\`\n`;
      }
    });
    
    response += '\n';
  });

  // 실행 통계 추가
  response += `---\n`;
  response += `📊 **실행 통계**: ${summary.successCount}/${summary.totalCount}개 명령어 성공`;
  response += ` (평균 ${summary.averageExecutionTime.toFixed(0)}ms)\n`;
  response += `🔧 **사용된 도구**: ${summary.categories.join(', ')}`;

  return response;
}

/**
 * 카테고리 표시명 반환
 */
function getCategoryDisplayName(category: string): string {
  const displayNames: Record<string, string> = {
    systemInfo: '🖥️ 시스템 정보',
    memoryUsage: '💾 메모리 사용량',
    cpuUsage: '⚡ CPU 사용률',
    diskUsage: '💿 디스크 사용량',
    networkInfo: '🌐 네트워크 정보',
    processInfo: '🔄 프로세스 정보'
  };
  
  return displayNames[category] || `📋 ${category}`;
}

/**
 * 결과 데이터 포맷팅
 */
function formatResultData(data: any, category: string): string {
  try {
    switch (category) {
      case 'systemInfo':
        return `**OS**: ${data.osName || 'Unknown'}\n**버전**: ${data.version || 'Unknown'}\n**호스트명**: ${data.hostname || 'Unknown'}\n**아키텍처**: ${data.architecture || 'Unknown'}\n\n`;
      
      case 'memoryUsage':
        return `**전체 메모리**: ${data.total || 'Unknown'}\n**사용 중**: ${data.used || 'Unknown'}\n**사용 가능**: ${data.free || 'Unknown'}\n\n`;
      
      case 'cpuUsage':
        return `**CPU 사용률**: ${data.userCpu || data.loadPercentage || 'Unknown'}%\n\n`;
      
      case 'diskUsage':
        let diskInfo = '';
        if (data.filesystems && data.filesystems.length > 0) {
          data.filesystems.forEach((fs: any) => {
            diskInfo += `**${fs.filesystem}**: ${fs.used}/${fs.size} (${fs.usePercent})\n`;
          });
        }
        return diskInfo + '\n';
      
      case 'networkInfo':
        let networkInfo = '';
        if (data.interfaces && data.interfaces.length > 0) {
          data.interfaces.forEach((iface: any) => {
            networkInfo += `**${iface.name}**: ${iface.ip || 'No IP'}\n`;
          });
        }
        return networkInfo + '\n';
      
      case 'processInfo':
        let processInfo = `**실행 중인 프로세스**: ${data.processes?.length || 0}개\n`;
        if (data.processes && data.processes.length > 0) {
          processInfo += data.processes.slice(0, 5).map((p: any) => 
            `• ${p.command} (PID: ${p.pid})`
          ).join('\n');
          if (data.processes.length > 5) {
            processInfo += `\n... 및 ${data.processes.length - 5}개 더`;
          }
        }
        return processInfo + '\n\n';
      
      default:
        return `${JSON.stringify(data, null, 2)}\n\n`;
    }
  } catch (error) {
    return `데이터 포맷팅 오류: ${error}\n\n`;
  }
}

/**
 * ExecutionResult를 기존 ToolResult 형태로 변환
 */
function convertToToolResult(result: ExecutionResult): any {
  return {
    success: result.success,
    result: result.result,
    error: result.error,
    executionTime: result.executionTime,
    command: result.command,
    category: result.category,
    timestamp: result.timestamp
  };
}