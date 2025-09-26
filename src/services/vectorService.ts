// Vector Database Service - 向量数据库集成
// 支持Pinecone进行知识向量存储和检索

interface VectorRecord {
  id: string;
  values: number[];
  metadata: {
    content: string;
    fileId: string;
    fileName: string;
    fileType: string;
    contentType?: string;
    bridgeTerms?: string[];
    technicalSpecs?: any[];
    chunkIndex?: number;
    createdAt: string;
  };
}

interface QueryResult {
  success: boolean;
  matches?: Array<{
    id: string;
    score: number;
    metadata: any;
    content: string;
  }>;
  error?: string;
}

interface EmbeddingResult {
  success: boolean;
  embedding?: number[];
  error?: string;
}

export class VectorService {
  private pineconeApiKey: string | undefined;
  private pineconeIndexUrl: string | undefined;
  private openaiApiKey: string | undefined;

  constructor(env: any) {
    this.pineconeApiKey = env.PINECONE_API_KEY;
    this.pineconeIndexUrl = env.PINECONE_INDEX_URL; // https://your-index-name.svc.your-environment.pinecone.io
    this.openaiApiKey = env.OPENAI_API_KEY;
  }

  // 生成文本嵌入向量
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    if (!this.openaiApiKey) {
      return {
        success: false,
        error: 'OpenAI API密钥未配置，无法生成嵌入向量'
      };
    }

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small', // 使用最新的嵌入模型
          input: text,
          encoding_format: 'float'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenAI嵌入API错误: ${errorData.error?.message || '请求失败'}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        embedding: data.data[0].embedding
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '嵌入向量生成失败'
      };
    }
  }

  // 将文档内容分块并存储到向量数据库
  async storeDocument(
    fileId: string,
    fileName: string,
    fileType: string,
    content: string,
    metadata: any = {}
  ): Promise<{ success: boolean; vectorCount?: number; error?: string }> {
    if (!this.pineconeApiKey || !this.pineconeIndexUrl) {
      return {
        success: false,
        error: 'Pinecone配置未完成'
      };
    }

    try {
      // 将长文本分割成块
      const chunks = this.splitTextIntoChunks(content, 1000); // 每块最多1000字符
      const vectorRecords: VectorRecord[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        // 为每个文本块生成嵌入向量
        const embeddingResult = await this.generateEmbedding(chunk);
        
        if (!embeddingResult.success || !embeddingResult.embedding) {
          console.error(`生成嵌入向量失败 - 块 ${i}:`, embeddingResult.error);
          continue;
        }

        // 创建向量记录
        const vectorRecord: VectorRecord = {
          id: `${fileId}_chunk_${i}`,
          values: embeddingResult.embedding,
          metadata: {
            content: chunk,
            fileId,
            fileName,
            fileType,
            chunkIndex: i,
            createdAt: new Date().toISOString(),
            ...metadata
          }
        };

        vectorRecords.push(vectorRecord);
      }

      if (vectorRecords.length === 0) {
        return {
          success: false,
          error: '没有成功生成任何向量记录'
        };
      }

      // 批量上传到Pinecone
      const uploadResult = await this.uploadVectors(vectorRecords);
      
      return {
        success: uploadResult.success,
        vectorCount: vectorRecords.length,
        error: uploadResult.error
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '文档存储失败'
      };
    }
  }

  // 查询相似文档
  async queryDocuments(
    queryText: string,
    topK: number = 5,
    filter?: any
  ): Promise<QueryResult> {
    if (!this.pineconeApiKey || !this.pineconeIndexUrl) {
      return {
        success: false,
        error: 'Pinecone配置未完成'
      };
    }

    try {
      // 生成查询文本的嵌入向量
      const embeddingResult = await this.generateEmbedding(queryText);
      
      if (!embeddingResult.success || !embeddingResult.embedding) {
        return {
          success: false,
          error: embeddingResult.error || '查询向量生成失败'
        };
      }

      // 查询Pinecone
      const response = await fetch(`${this.pineconeIndexUrl}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.pineconeApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vector: embeddingResult.embedding,
          topK,
          includeMetadata: true,
          filter
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Pinecone查询错误: ${errorData.message || '查询失败'}`);
      }

      const data = await response.json();
      
      const matches = data.matches?.map((match: any) => ({
        id: match.id,
        score: match.score,
        metadata: match.metadata,
        content: match.metadata?.content || ''
      })) || [];

      return {
        success: true,
        matches
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '文档查询失败'
      };
    }
  }

  // 删除文档的所有向量
  async deleteDocument(fileId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.pineconeApiKey || !this.pineconeIndexUrl) {
      return {
        success: false,
        error: 'Pinecone配置未完成'
      };
    }

    try {
      const response = await fetch(`${this.pineconeIndexUrl}/delete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.pineconeApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filter: {
            fileId: { '$eq': fileId }
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Pinecone删除错误: ${errorData.message || '删除失败'}`);
      }

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '文档删除失败'
      };
    }
  }

  // 上传向量到Pinecone
  private async uploadVectors(vectors: VectorRecord[]): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.pineconeIndexUrl}/upsert`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.pineconeApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vectors
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Pinecone上传错误: ${errorData.message || '上传失败'}`);
      }

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '向量上传失败'
      };
    }
  }

  // 将长文本分割成块
  private splitTextIntoChunks(text: string, maxChunkSize: number = 1000): string[] {
    const chunks: string[] = [];
    
    // 优先按段落分割
    const paragraphs = text.split(/\\n\\s*\\n/);
    let currentChunk = '';
    
    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length <= maxChunkSize) {
        currentChunk += (currentChunk ? '\\n\\n' : '') + paragraph;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = paragraph;
        } else {
          // 如果单个段落太长，按句子分割
          const sentences = paragraph.split(/[。！？.!?]/);
          let sentenceChunk = '';
          
          for (const sentence of sentences) {
            if (sentenceChunk.length + sentence.length <= maxChunkSize) {
              sentenceChunk += sentence;
            } else {
              if (sentenceChunk) {
                chunks.push(sentenceChunk.trim());
              }
              sentenceChunk = sentence;
            }
          }
          
          if (sentenceChunk) {
            currentChunk = sentenceChunk;
          }
        }
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks.filter(chunk => chunk.length > 0);
  }

  // 获取索引统计信息
  async getIndexStats(): Promise<any> {
    if (!this.pineconeApiKey || !this.pineconeIndexUrl) {
      return null;
    }

    try {
      const response = await fetch(`${this.pineconeIndexUrl}/describe_index_stats`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.pineconeApiKey}`,
        },
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();

    } catch (error) {
      console.error('获取索引统计失败:', error);
      return null;
    }
  }
}

export type { VectorRecord, QueryResult, EmbeddingResult };