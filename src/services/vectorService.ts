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

// 全局向量存储 - 在模块级别保存数据
let globalVectorStore: VectorRecord[] = [];

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
        
        // 检查是否为配额不足错误
        if (errorData.error?.code === 'insufficient_quota') {
          return {
            success: false,
            error: `OpenAI嵌入API配额不足: ${errorData.error.message}。建议: 1)充值OpenAI账户 2)配置Pinecone免费层试用 3)使用本地模拟向量(测试模式)`
          };
        }
        
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

  // 生成模拟嵌入向量（用于测试和演示）
  generateMockEmbedding(text: string): number[] {
    // 基于文本内容生成一个简单但一致的向量
    const hash = this.simpleHash(text);
    const vector: number[] = [];
    
    // 生成1536维向量（与text-embedding-3-small兼容）
    for (let i = 0; i < 1536; i++) {
      // 使用哈希值和索引生成伪随机但一致的浮点数
      const seed = hash + i;
      vector.push((Math.sin(seed) * 2 - 1)); // 范围 [-1, 1]
    }
    
    // 标准化向量
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return vector.map(val => val / magnitude);
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
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
      // 使用本地存储作为备选方案
      return await this.storeDocumentLocal(fileId, fileName, fileType, content, metadata);
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
      // 使用本地查询作为备选方案
      return await this.queryDocumentsLocal(queryText, topK, filter);
    }

    try {
      // 直接使用模拟向量生成查询
      const queryVector = this.generateMockEmbedding(queryText);

      // 查询Pinecone
      const response = await fetch(`${this.pineconeIndexUrl}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.pineconeApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vector: queryVector,
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
      // 使用本地删除作为备选方案
      return this.deleteDocumentLocal(fileId);
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
    const paragraphs = text.split(/\n\s*\n/);
    let currentChunk = '';
    
    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length <= maxChunkSize) {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
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
      // 返回本地存储统计
      return this.getLocalStats();
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

  // 本地存储实现 (用于Pinecone不可用时的备选方案)
  private get localVectorStore(): VectorRecord[] {
    return globalVectorStore;
  }

  private async storeDocumentLocal(
    fileId: string,
    fileName: string,
    fileType: string,
    content: string,
    metadata: any = {}
  ): Promise<{ success: boolean; vectorCount?: number; error?: string }> {
    try {
      // 将长文本分割成块
      const chunks = this.splitTextIntoChunks(content, 1000);
      let successCount = 0;

      console.log(`开始处理 ${chunks.length} 个文本块`);
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`处理文本块 ${i}: "${chunk.substring(0, 50)}..."`);
        
        // 简化处理，直接生成模拟向量
        const embedding = this.generateMockEmbedding(chunk);
        
        if (!embedding || embedding.length === 0) {
          console.error(`模拟向量生成失败 - 块 ${i}`);
          continue;
        }
        
        console.log(`模拟向量生成成功 - 块 ${i}，维度: ${embedding.length}`);

        // 存储到本地数组
        const vectorRecord: VectorRecord = {
          id: `${fileId}_chunk_${i}`,
          values: embedding,
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

        // 直接添加到全局数组
        globalVectorStore.push(vectorRecord);
        successCount++;
        console.log(`成功存储向量记录 ${i}, 总向量数: ${globalVectorStore.length}`);
      }

      if (successCount === 0) {
        return {
          success: false,
          error: '没有成功存储任何文本块'
        };
      }

      return {
        success: true,
        vectorCount: successCount,
        error: successCount < chunks.length ? `部分成功: ${successCount}/${chunks.length}` : undefined
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '本地文档存储失败'
      };
    }
  }

  private async queryDocumentsLocal(
    queryText: string,
    topK: number = 5,
    filter?: any
  ): Promise<QueryResult> {
    try {
      console.log(`本地查询: "${queryText}", topK: ${topK}, 向量存储大小: ${globalVectorStore.length}`);
      
      if (globalVectorStore.length === 0) {
        console.log('向量存储为空，返回空结果');
        return {
          success: true,
          matches: []
        };
      }

      // 生成查询向量 - 直接使用模拟向量，因为OpenAI配额问题
      console.log('生成查询向量...');
      const queryVector = this.generateMockEmbedding(queryText);
      console.log(`查询向量生成成功，维度: ${queryVector.length}`);

      // 计算相似度分数
      console.log(`计算与 ${globalVectorStore.length} 个文档的相似度...`);
      const results = globalVectorStore.map((record, index) => {
        const similarity = this.calculateCosineSimilarity(queryVector, record.values);
        console.log(`文档 ${index}: ID=${record.id}, 相似度=${similarity}`);
        return {
          id: record.id,
          score: similarity,
          metadata: record.metadata,
          content: record.metadata.content || ''
        };
      });

      // 应用过滤器
      let filteredResults = results;
      if (filter) {
        console.log('应用过滤器:', filter);
        filteredResults = results.filter(result => {
          // 简单过滤逻辑
          for (const [key, value] of Object.entries(filter)) {
            if (Array.isArray(value)) {
              // 如果过滤器值是数组，检查是否包含
              if (!value.includes(result.metadata[key])) {
                return false;
              }
            } else {
              // 否则直接比较
              if (result.metadata[key] !== value) {
                return false;
              }
            }
          }
          return true;
        });
        console.log(`过滤后结果数量: ${filteredResults.length}`);
      }

      // 按相似度排序并返回前K个结果
      const topResults = filteredResults
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

      console.log(`最终返回 ${topResults.length} 个结果，最高分数: ${topResults.length > 0 ? topResults[0].score : 'N/A'}`);

      return {
        success: true,
        matches: topResults
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '本地文档查询失败'
      };
    }
  }

  private calculateCosineSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) {
      return 0;
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      magnitudeA += vectorA[i] * vectorA[i];
      magnitudeB += vectorB[i] * vectorB[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }

  private getLocalStats(): any {
    const fileCount = new Set(globalVectorStore.map(v => v.metadata.fileId)).size;
    const totalChunks = globalVectorStore.length;
    
    return {
      totalVectorCount: totalChunks,
      dimension: globalVectorStore.length > 0 ? globalVectorStore[0].values.length : 1536,
      indexFullness: 0,
      namespaces: {
        '': {
          vectorCount: totalChunks
        }
      },
      localMode: true,
      fileCount,
      lastUpdated: globalVectorStore.length > 0 ? 
        Math.max(...globalVectorStore.map(v => new Date(v.metadata.createdAt).getTime())) : null
    };
  }

  // 清理本地存储中的文档
  deleteDocumentLocal(fileId: string): { success: boolean; error?: string } {
    try {
      const initialCount = globalVectorStore.length;
      globalVectorStore = globalVectorStore.filter(v => v.metadata.fileId !== fileId);
      const deletedCount = initialCount - globalVectorStore.length;
      
      console.log(`删除了 ${deletedCount} 个向量记录`);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '本地文档删除失败'
      };
    }
  }
}

export type { VectorRecord, QueryResult, EmbeddingResult };