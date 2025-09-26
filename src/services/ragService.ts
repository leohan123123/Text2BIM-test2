// RAG (Retrieval-Augmented Generation) Service
// 检索增强生成服务，用于桥梁专业知识问答

import { VectorService, type QueryResult } from './vectorService';
import { AIService, type AIMessage } from './aiService';

interface RAGResult {
  success: boolean;
  answer?: string;
  sources?: Array<{
    content: string;
    fileName: string;
    fileType: string;
    relevanceScore: number;
  }>;
  error?: string;
  model?: string;
}

interface KnowledgeBase {
  vectorCount: number;
  documentCount: number;
  lastUpdated: string;
  categories: {
    documents: number;
    models: number;
    drawings: number;
  };
}

export class RAGService {
  private vectorService: VectorService;
  private aiService: AIService;

  constructor(env: any) {
    this.vectorService = new VectorService(env);
    this.aiService = new AIService(env);
  }

  // 智能问答 - RAG核心功能
  async askQuestion(
    question: string,
    model: string = 'gpt',
    options: {
      maxSources?: number;
      minRelevanceScore?: number;
      includeHistory?: boolean;
      conversationHistory?: AIMessage[];
    } = {}
  ): Promise<RAGResult> {
    try {
      const {
        maxSources = 5,
        minRelevanceScore = 0.7,
        conversationHistory = []
      } = options;

      // 1. 检索相关文档
      const retrievalResult = await this.vectorService.queryDocuments(
        question,
        maxSources
      );

      if (!retrievalResult.success) {
        // 如果检索失败，直接使用AI回答
        console.warn('向量检索失败，回退到直接AI回答:', retrievalResult.error);
        return this.fallbackToDirectAI(question, model, conversationHistory);
      }

      // 2. 过滤低相关性的结果
      const relevantSources = retrievalResult.matches?.filter(
        match => match.score >= minRelevanceScore
      ) || [];

      if (relevantSources.length === 0) {
        // 如果没有相关文档，直接使用AI回答
        console.log('未找到相关文档，使用通用AI回答');
        return this.fallbackToDirectAI(question, model, conversationHistory);
      }

      // 3. 构建带上下文的提示词
      const contextPrompt = this.buildContextPrompt(question, relevantSources);

      // 4. 构建对话消息
      const messages: AIMessage[] = [
        ...conversationHistory.slice(-6), // 保留最近3轮对话
        {
          role: 'user',
          content: contextPrompt
        }
      ];

      // 5. 调用AI生成回答
      const aiResponse = await this.aiService.chat(messages, model);

      if (!aiResponse.success) {
        return {
          success: false,
          error: `AI回答生成失败: ${aiResponse.error}`
        };
      }

      // 6. 整理数据源信息
      const sources = relevantSources.map(match => ({
        content: match.content.substring(0, 300) + (match.content.length > 300 ? '...' : ''),
        fileName: match.metadata?.fileName || '未知文件',
        fileType: match.metadata?.fileType || 'unknown',
        relevanceScore: Math.round(match.score * 100) / 100
      }));

      return {
        success: true,
        answer: aiResponse.response,
        sources,
        model: aiResponse.model
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'RAG问答失败'
      };
    }
  }

  // 添加文档到知识库
  async addToKnowledgeBase(
    fileId: string,
    fileName: string,
    fileType: string,
    content: string,
    metadata: any = {}
  ): Promise<{ success: boolean; vectorCount?: number; error?: string }> {
    try {
      // 增强桥梁专业内容
      const enhancedContent = this.enhanceBridgeContent(content, metadata);
      
      console.log('RAG: 原始内容:', content);
      console.log('RAG: 增强内容:', enhancedContent);
      console.log('RAG: 调用向量服务...');
      
      // 直接调用本地存储，因为没有Pinecone配置
      const result = await (this.vectorService as any).storeDocumentLocal(
        fileId,
        fileName,
        fileType,
        enhancedContent,
        {
          ...metadata,
          addedToKB: new Date().toISOString(),
          enhancedForBridge: true
        }
      );

      console.log('RAG: 向量服务结果:', result);
      return result;

    } catch (error) {
      console.error('RAG: 添加到知识库失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '添加到知识库失败'
      };
    }
  }

  // 从知识库删除文档
  async removeFromKnowledgeBase(fileId: string): Promise<{ success: boolean; error?: string }> {
    return await this.vectorService.deleteDocument(fileId);
  }

  // 获取知识库状态
  async getKnowledgeBaseStatus(): Promise<KnowledgeBase | null> {
    try {
      const stats = await this.vectorService.getIndexStats();
      
      if (!stats) {
        return null;
      }

      // 解析统计信息
      const vectorCount = stats.totalVectorCount || 0;
      const namespaces = stats.namespaces || {};
      
      let documentCount = 0;
      let categories = { documents: 0, models: 0, drawings: 0 };
      
      // 统计不同类型的文档（基于命名空间或其他统计）
      Object.keys(namespaces).forEach(namespace => {
        const count = namespaces[namespace].vectorCount || 0;
        documentCount += count;
        
        if (namespace.includes('pdf') || namespace.includes('documents')) {
          categories.documents += count;
        } else if (namespace.includes('ifc') || namespace.includes('models')) {
          categories.models += count;
        } else if (namespace.includes('dxf') || namespace.includes('drawings')) {
          categories.drawings += count;
        }
      });

      return {
        vectorCount,
        documentCount,
        lastUpdated: new Date().toISOString(),
        categories
      };

    } catch (error) {
      console.error('获取知识库状态失败:', error);
      return null;
    }
  }

  // 搜索知识库
  async searchKnowledgeBase(
    query: string,
    options: {
      maxResults?: number;
      fileTypes?: string[];
      minScore?: number;
    } = {}
  ): Promise<QueryResult> {
    const { maxResults = 10, fileTypes, minScore = 0.6 } = options;
    
    console.log('RAG搜索: 查询:', query, '选项:', options);
    
    // 构建过滤器
    let filter: any = {};
    if (fileTypes && fileTypes.length > 0) {
      filter.fileType = fileTypes; // 简化过滤器，因为本地实现
    }

    // 直接使用本地查询
    const result = await (this.vectorService as any).queryDocumentsLocal(query, maxResults, filter);
    
    console.log('RAG搜索结果:', result);
    
    if (result.success && result.matches) {
      // 过滤低分结果
      result.matches = result.matches.filter(match => match.score >= minScore);
      console.log('过滤后结果数量:', result.matches.length);
    }
    
    return result;
  }

  // 构建带上下文的提示词
  private buildContextPrompt(question: string, sources: any[]): string {
    const contextText = sources.map((source, index) => 
      `[文档${index + 1}] ${source.metadata?.fileName} (相关度: ${Math.round(source.score * 100)}%)\\n${source.content}`
    ).join('\\n\\n');

    return `你是一个专业的桥梁工程智能体。请基于以下相关文档内容回答用户的问题。

相关文档内容:
${contextText}

用户问题: ${question}

请基于上述文档内容提供专业、准确的回答。如果文档内容不足以完全回答问题，请说明并提供你的专业建议。请在回答中引用具体的文档来源。`;
  }

  // 回退到直接AI回答（当检索失败时）
  private async fallbackToDirectAI(
    question: string,
    model: string,
    history: AIMessage[]
  ): Promise<RAGResult> {
    try {
      const enhancedQuestion = this.aiService.enhanceBridgeQuery(question);
      
      const messages: AIMessage[] = [
        ...history.slice(-6),
        {
          role: 'user',
          content: enhancedQuestion
        }
      ];

      const aiResponse = await this.aiService.chat(messages, model);
      
      if (!aiResponse.success) {
        return {
          success: false,
          error: aiResponse.error || 'AI回答失败'
        };
      }

      return {
        success: true,
        answer: aiResponse.response,
        sources: [], // 没有检索到相关文档
        model: aiResponse.model
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '回退AI回答失败'
      };
    }
  }

  // 增强桥梁专业内容
  private enhanceBridgeContent(content: string, metadata: any): string {
    let enhancedContent = content;

    // 添加桥梁专业标签
    const bridgeKeywords = [
      '承载力', '安全系数', '荷载', '弯矩', '剪力', '挠度',
      '混凝土', '钢筋', '预应力', '徐变', '收缩', '疲劳',
      '桥墩', '桥台', '桥面', '主梁', '桥跨', '支座',
      '伸缩缝', '排水', '护栏', '抗震', '风荷载'
    ];

    // 为专业术语添加上下文标记
    for (const keyword of bridgeKeywords) {
      const regex = new RegExp(`(${keyword})`, 'g');
      enhancedContent = enhancedContent.replace(regex, `[桥梁术语:$1]`);
    }

    // 添加元数据信息
    if (metadata.contentType) {
      enhancedContent = `[文档类型: ${metadata.contentType}]\n${enhancedContent}`;
    }

    if (metadata.bridgeTermsFound && metadata.bridgeTermsFound.length > 0) {
      enhancedContent = `[包含术语: ${metadata.bridgeTermsFound.join(', ')}]\n${enhancedContent}`;
    }

    return enhancedContent;
  }

  // 生成知识库摘要
  async generateKnowledgeSummary(): Promise<string> {
    try {
      const status = await this.getKnowledgeBaseStatus();
      
      if (!status) {
        return '知识库状态未知，可能未正确配置向量数据库。';
      }

      let summary = `桥梁智能体知识库状态:\n\n`;
      summary += `📊 总向量数: ${status.vectorCount}\n`;
      summary += `📁 文档数量: ${status.documentCount}\n`;
      summary += `📄 规范文档: ${status.categories.documents}\n`;
      summary += `🏗️ BIM模型: ${status.categories.models}\n`;
      summary += `📐 CAD图纸: ${status.categories.drawings}\n`;
      summary += `🕐 最后更新: ${new Date(status.lastUpdated).toLocaleString('zh-CN')}`;

      return summary;

    } catch (error) {
      return '无法获取知识库状态，请检查向量数据库配置。';
    }
  }
}

export type { RAGResult, KnowledgeBase };