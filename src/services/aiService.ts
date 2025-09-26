// AI Service Integration
// 支持多个LLM API的桥梁智能体服务

interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface AIResponse {
  success: boolean;
  response?: string;
  error?: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class AIService {
  private openaiApiKey: string | undefined;
  private anthropicApiKey: string | undefined;
  private geminiApiKey: string | undefined;
  private qwenApiKey: string | undefined;

  constructor(env: any) {
    this.openaiApiKey = env.OPENAI_API_KEY;
    this.anthropicApiKey = env.ANTHROPIC_API_KEY;
    this.geminiApiKey = env.GEMINI_API_KEY;
    this.qwenApiKey = env.QWEN_API_KEY;
  }

  async chat(messages: AIMessage[], model: string = 'gpt'): Promise<AIResponse> {
    try {
      switch (model) {
        case 'gpt':
          return await this.chatWithOpenAI(messages);
        case 'claude':
          return await this.chatWithClaude(messages);
        case 'gemini':
          return await this.chatWithGemini(messages);
        case 'qwen':
          return await this.chatWithQwen(messages);
        default:
          throw new Error(`不支持的模型: ${model}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        model
      };
    }
  }

  private async chatWithOpenAI(messages: AIMessage[]): Promise<AIResponse> {
    if (!this.openaiApiKey) {
      throw new Error('OpenAI API密钥未配置');
    }

    const systemMessage: AIMessage = {
      role: 'system',
      content: `你是一个专业的桥梁工程智能体。你具备以下能力：
1. 深度理解桥梁工程设计原理、结构力学、材料科学
2. 熟悉国内外桥梁设计规范和标准
3. 能够分析BIM模型、CAD图纸和技术文档
4. 提供专业的桥梁设计建议和安全评估
5. 解答桥梁施工、维护和检测相关问题

请用专业但易懂的语言回答用户的桥梁相关问题。`
    };

    const apiMessages = [systemMessage, ...messages];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // 使用性价比较高的模型
        messages: apiMessages,
        max_tokens: 2000,
        temperature: 0.7,
        presence_penalty: 0.1,
        frequency_penalty: 0.1
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API错误: ${errorData.error?.message || '请求失败'}`);
    }

    const data = await response.json();
    
    return {
      success: true,
      response: data.choices[0].message.content,
      model: 'GPT-4o Mini',
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      }
    };
  }

  private async chatWithClaude(messages: AIMessage[]): Promise<AIResponse> {
    if (!this.anthropicApiKey) {
      throw new Error('Claude API密钥未配置');
    }

    const systemPrompt = `你是一个专业的桥梁工程智能体。你具备以下能力：
1. 深度理解桥梁工程设计原理、结构力学、材料科学
2. 熟悉国内外桥梁设计规范和标准
3. 能够分析BIM模型、CAD图纸和技术文档
4. 提供专业的桥梁设计建议和安全评估
5. 解答桥梁施工、维护和检测相关问题

请用专业但易懂的语言回答用户的桥梁相关问题。`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.anthropicApiKey}`,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        system: systemPrompt,
        messages: messages.filter(m => m.role !== 'system'),
        temperature: 0.7
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Claude API错误: ${errorData.error?.message || '请求失败'}`);
    }

    const data = await response.json();
    
    return {
      success: true,
      response: data.content[0].text,
      model: 'Claude 3.5 Sonnet',
      usage: {
        promptTokens: data.usage?.input_tokens || 0,
        completionTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
      }
    };
  }

  private async chatWithGemini(messages: AIMessage[]): Promise<AIResponse> {
    if (!this.geminiApiKey) {
      throw new Error('Gemini API密钥未配置');
    }

    const systemPrompt = `你是一个专业的桥梁工程智能体。你具备以下能力：
1. 深度理解桥梁工程设计原理、结构力学、材料科学
2. 熟悉国内外桥梁设计规范和标准
3. 能够分析BIM模型、CAD图纸和技术文档
4. 提供专业的桥梁设计建议和安全评估
5. 解答桥梁施工、维护和检测相关问题

请用专业但易懂的语言回答用户的桥梁相关问题。`;

    // 将消息格式转换为Gemini格式
    const contents = [{
      parts: [{ text: systemPrompt }]
    }];
    
    messages.forEach(msg => {
      if (msg.role !== 'system') {
        contents.push({
          parts: [{ text: msg.content }]
        });
      }
    });

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-exp:generateContent?key=${this.geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2000,
          topP: 0.9,
          topK: 40
        }
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Gemini API错误: ${errorData.error?.message || '请求失败'}`);
    }

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('Gemini API返回格式错误');
    }
    
    return {
      success: true,
      response: data.candidates[0].content.parts[0].text,
      model: 'Gemini 2.5 Flash',
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount || 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0
      }
    };
  }

  private async chatWithQwen(messages: AIMessage[]): Promise<AIResponse> {
    if (!this.qwenApiKey) {
      throw new Error('Qwen API密钥未配置');
    }

    const systemMessage: AIMessage = {
      role: 'system',
      content: `你是一个专业的桥梁工程智能体。你具备以下能力：
1. 深度理解桥梁工程设计原理、结构力学、材料科学
2. 熟悉国内外桥梁设计规范和标准
3. 能够分析BIM模型、CAD图纸和技术文档
4. 提供专业的桥梁设计建议和安全评估
5. 解答桥梁施工、维护和检测相关问题

请用专业但易懂的语言回答用户的桥梁相关问题。`
    };

    const apiMessages = [systemMessage, ...messages];

    const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.qwenApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen2.5-72b-instruct',
        input: {
          messages: apiMessages
        },
        parameters: {
          max_tokens: 2000,
          temperature: 0.7,
          top_p: 0.9,
          repetition_penalty: 1.1
        }
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Qwen API错误: ${errorData.message || '请求失败'}`);
    }

    const data = await response.json();
    
    if (data.output?.text) {
      return {
        success: true,
        response: data.output.text,
        model: 'Qwen 2.5-72B',
        usage: {
          promptTokens: data.usage?.input_tokens || 0,
          completionTokens: data.usage?.output_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0
        }
      };
    } else {
      throw new Error('Qwen API返回格式错误');
    }
  }

  // 桥梁专业知识增强方法
  enhanceBridgeQuery(userQuery: string): string {
    const enhancedQuery = `作为桥梁工程专家，请分析以下问题并提供专业建议：

用户问题: ${userQuery}

请从以下角度进行分析：
1. 工程技术角度
2. 安全性考虑
3. 经济性评估
4. 施工可行性
5. 相关规范标准

请提供具体、实用的建议。`;

    return enhancedQuery;
  }
}

export type { AIMessage, AIResponse };