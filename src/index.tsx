import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { AIService, type AIMessage } from './services/aiService'
import { FileParsingService, type ParsingResult } from './services/fileParsingService'
import { StorageService, type StorageResult } from './services/storageService'
import { RAGService, type RAGResult } from './services/ragService'
import { VectorService } from './services/vectorService'

type Bindings = {
  DB?: D1Database;
  KV?: KVNamespace;
  R2?: R2Bucket;
  AI?: any;
  // API Keys
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  GEMINI_API_KEY?: string;
  QWEN_API_KEY?: string;
  PINECONE_API_KEY?: string;
  PINECONE_INDEX_URL?: string;
  ENVIRONMENT?: string;
}

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS for API routes
app.use('/api/*', cors())

// Serve static files
app.use('/static/*', serveStatic({ root: './public' }))

// Main page
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>桥梁智能体 (Bridge Agent)</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/three@0.158.0/examples/js/controls/OrbitControls.js"></script>
        <link href="/static/style.css" rel="stylesheet">
    </head>
    <body class="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
        <!-- Header -->
        <header class="bg-white shadow-lg border-b border-blue-200">
            <div class="max-w-7xl mx-auto px-4 py-6">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                        <div class="bg-gradient-to-r from-blue-500 to-indigo-600 p-3 rounded-lg">
                            <i class="fas fa-bridge text-white text-2xl"></i>
                        </div>
                        <div>
                            <h1 class="text-3xl font-bold text-gray-800">桥梁智能体</h1>
                            <p class="text-sm text-gray-600">Bridge Agent - 智能桥梁设计与分析系统</p>
                        </div>
                    </div>
                    <div class="flex items-center space-x-4">
                        <div class="bg-green-100 px-3 py-1 rounded-full">
                            <span class="text-green-800 text-sm font-medium">🟢 在线</span>
                        </div>
                    </div>
                </div>
            </div>
        </header>

        <!-- Main Content -->
        <div class="max-w-7xl mx-auto px-4 py-8">
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <!-- Left Panel - File Upload -->
                <div class="lg:col-span-1">
                    <div class="bg-white rounded-xl shadow-lg p-6 mb-6">
                        <h2 class="text-xl font-bold text-gray-800 mb-4 flex items-center">
                            <i class="fas fa-upload mr-3 text-blue-500"></i>
                            文件上传
                        </h2>
                        
                        <!-- File Upload Areas -->
                        <div class="space-y-4">
                            <!-- PDF Upload -->
                            <div class="border-2 border-dashed border-blue-300 rounded-lg p-4 hover:border-blue-500 transition-colors cursor-pointer" id="pdf-upload">
                                <div class="text-center">
                                    <i class="fas fa-file-pdf text-red-500 text-3xl mb-2"></i>
                                    <p class="text-sm font-medium text-gray-700">PDF 规范文档</p>
                                    <p class="text-xs text-gray-500">拖拽或点击上传</p>
                                </div>
                                <input type="file" accept=".pdf" class="hidden" id="pdf-input">
                            </div>

                            <!-- IFC Upload -->
                            <div class="border-2 border-dashed border-green-300 rounded-lg p-4 hover:border-green-500 transition-colors cursor-pointer" id="ifc-upload">
                                <div class="text-center">
                                    <i class="fas fa-cube text-green-500 text-3xl mb-2"></i>
                                    <p class="text-sm font-medium text-gray-700">IFC BIM 模型</p>
                                    <p class="text-xs text-gray-500">拖拽或点击上传</p>
                                </div>
                                <input type="file" accept=".ifc" class="hidden" id="ifc-input">
                            </div>

                            <!-- DXF Upload -->
                            <div class="border-2 border-dashed border-purple-300 rounded-lg p-4 hover:border-purple-500 transition-colors cursor-pointer" id="dxf-upload">
                                <div class="text-center">
                                    <i class="fas fa-drafting-compass text-purple-500 text-3xl mb-2"></i>
                                    <p class="text-sm font-medium text-gray-700">DXF CAD 图纸</p>
                                    <p class="text-xs text-gray-500">拖拽或点击上传</p>
                                </div>
                                <input type="file" accept=".dxf" class="hidden" id="dxf-input">
                            </div>
                        </div>

                        <!-- Process Button -->
                        <button id="process-btn" class="w-full mt-6 bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-3 px-4 rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                            <i class="fas fa-cog mr-2"></i>
                            开始处理文件
                        </button>
                    </div>

                    <!-- Progress Panel -->
                    <div class="bg-white rounded-xl shadow-lg p-6" id="progress-panel" style="display: none;">
                        <h3 class="text-lg font-bold text-gray-800 mb-4">处理进度</h3>
                        <div class="space-y-3">
                            <div class="flex items-center justify-between">
                                <span class="text-sm text-gray-600">文件上传</span>
                                <i class="fas fa-check text-green-500" id="upload-status"></i>
                            </div>
                            <div class="flex items-center justify-between">
                                <span class="text-sm text-gray-600">文件解析</span>
                                <i class="fas fa-spinner fa-spin text-blue-500" id="parse-status"></i>
                            </div>
                            <div class="flex items-center justify-between">
                                <span class="text-sm text-gray-600">知识提取</span>
                                <i class="fas fa-clock text-gray-400" id="extract-status"></i>
                            </div>
                            <div class="flex items-center justify-between">
                                <span class="text-sm text-gray-600">模型训练</span>
                                <i class="fas fa-clock text-gray-400" id="train-status"></i>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Center Panel - Chat Interface -->
                <div class="lg:col-span-1">
                    <div class="bg-white rounded-xl shadow-lg p-6 h-[600px] flex flex-col">
                        <h2 class="text-xl font-bold text-gray-800 mb-4 flex items-center">
                            <i class="fas fa-comments mr-3 text-green-500"></i>
                            智能对话
                        </h2>
                        
                        <!-- Chat Messages -->
                        <div class="flex-1 overflow-y-auto mb-4 p-4 border border-gray-200 rounded-lg" id="chat-messages">
                            <div class="flex items-start mb-4">
                                <div class="bg-blue-500 text-white p-2 rounded-full mr-3">
                                    <i class="fas fa-robot"></i>
                                </div>
                                <div class="bg-blue-50 p-3 rounded-lg flex-1">
                                    <p class="text-sm text-gray-800">您好！我是桥梁智能体，可以帮助您分析桥梁设计、解读规范文档、生成图纸和模型。请上传相关文件开始使用。</p>
                                </div>
                            </div>
                        </div>

                        <!-- Chat Input -->
                        <div class="flex space-x-2">
                            <input type="text" id="chat-input" placeholder="请输入您的问题..." class="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <button id="send-btn" class="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors">
                                <i class="fas fa-paper-plane"></i>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Right Panel - Visualization -->
                <div class="lg:col-span-1">
                    <div class="bg-white rounded-xl shadow-lg p-6 mb-6">
                        <h2 class="text-xl font-bold text-gray-800 mb-4 flex items-center">
                            <i class="fas fa-eye mr-3 text-purple-500"></i>
                            3D 可视化
                        </h2>
                        <div id="three-container" class="w-full h-64 bg-gray-100 rounded-lg border-2 border-gray-200 flex items-center justify-center">
                            <div class="text-center text-gray-500">
                                <i class="fas fa-cube text-4xl mb-2"></i>
                                <p>3D 模型将在此显示</p>
                            </div>
                        </div>
                    </div>

                    <!-- Model Selection -->
                    <div class="bg-white rounded-xl shadow-lg p-6 mb-6">
                        <h3 class="text-lg font-bold text-gray-800 mb-4 flex items-center">
                            <i class="fas fa-brain mr-3 text-yellow-500"></i>
                            AI 模型选择
                        </h3>
                        <div class="space-y-2">
                            <label class="flex items-center">
                                <input type="radio" name="model" value="gpt" class="mr-2" checked>
                                <span class="text-sm">GPT-4o (推荐)</span>
                            </label>
                            <label class="flex items-center">
                                <input type="radio" name="model" value="claude" class="mr-2">
                                <span class="text-sm">Claude 3.5 Sonnet</span>
                            </label>
                            <label class="flex items-center">
                                <input type="radio" name="model" value="gemini" class="mr-2">
                                <span class="text-sm">Gemini 2.5 Pro</span>
                            </label>
                            <label class="flex items-center">
                                <input type="radio" name="model" value="qwen" class="mr-2">
                                <span class="text-sm">Qwen 2.5</span>
                            </label>
                        </div>
                    </div>
                    
                    <!-- RAG Settings -->
                    <div class="bg-white rounded-xl shadow-lg p-6 mb-6">
                        <h3 class="text-lg font-bold text-gray-800 mb-4 flex items-center">
                            <i class="fas fa-database mr-3 text-purple-500"></i>
                            智能问答设置
                        </h3>
                        <div class="space-y-3">
                            <label class="flex items-center justify-between">
                                <span class="text-sm text-gray-700">启用RAG知识库</span>
                                <input type="checkbox" id="rag-toggle" class="toggle-checkbox" checked>
                            </label>
                            <div class="text-xs text-gray-500">
                                开启后将优先使用已上传的文档内容回答问题
                            </div>
                        </div>
                    </div>
                    
                    <!-- Knowledge Base Status -->
                    <div class="bg-white rounded-xl shadow-lg p-6" id="kb-status-panel" style="display: none;">
                        <h3 class="text-lg font-bold text-gray-800 mb-4 flex items-center">
                            <i class="fas fa-info-circle mr-3 text-blue-500"></i>
                            知识库状态
                        </h3>
                        <div id="kb-status-content" class="text-sm text-gray-600">
                            正在加载...
                        </div>
                        <button id="refresh-kb-btn" class="mt-3 text-sm text-blue-600 hover:text-blue-800">
                            <i class="fas fa-refresh mr-1"></i>刷新状态
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Custom Styles for Toggle -->
        <style>
        .toggle-checkbox {
            appearance: none;
            width: 50px;
            height: 25px;
            background: #d1d5db;
            border-radius: 25px;
            position: relative;
            cursor: pointer;
            transition: background 0.3s;
        }
        .toggle-checkbox:checked {
            background: #3b82f6;
        }
        .toggle-checkbox::before {
            content: '';
            position: absolute;
            width: 21px;
            height: 21px;
            border-radius: 50%;
            background: white;
            top: 2px;
            left: 2px;
            transition: transform 0.3s;
        }
        .toggle-checkbox:checked::before {
            transform: translateX(25px);
        }
        </style>
        
        <!-- Scripts -->
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/app.js"></script>
    </body>
    </html>
  `)
})

// API Routes
// File access API - 从R2获取文件
app.get('/api/files/:key', async (c) => {
  try {
    const key = decodeURIComponent(c.req.param('key'))
    const storageService = new StorageService(c.env)
    
    const fileObject = await storageService.getFile(key)
    
    if (!fileObject) {
      return c.notFound()
    }

    return new Response(fileObject.body, {
      headers: {
        'Content-Type': fileObject.httpMetadata?.contentType || 'application/octet-stream',
        'Content-Disposition': fileObject.httpMetadata?.contentDisposition || 'attachment',
        'Cache-Control': 'public, max-age=31536000', // 1年缓存
      }
    })
    
  } catch (error) {
    console.error('File access error:', error)
    return c.json({ error: '文件访问失败' }, 500)
  }
})

// Knowledge Base API - 知识库管理
app.get('/api/knowledge/status', async (c) => {
  try {
    const ragService = new RAGService(c.env)
    const status = await ragService.getKnowledgeBaseStatus()
    
    if (!status) {
      return c.json({
        success: false,
        error: '知识库未配置或无法访问',
        configured: !!(c.env.PINECONE_API_KEY && c.env.PINECONE_INDEX_URL)
      })
    }
    
    return c.json({
      success: true,
      status,
      summary: await ragService.generateKnowledgeSummary()
    })
    
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : '获取知识库状态失败'
    }, 500)
  }
})

app.post('/api/knowledge/search', async (c) => {
  try {
    const { query, maxResults = 10, fileTypes, minScore = 0.6 } = await c.req.json()
    
    if (!query) {
      return c.json({ success: false, error: '搜索关键词不能为空' }, 400)
    }
    
    const ragService = new RAGService(c.env)
    const result = await ragService.searchKnowledgeBase(query, {
      maxResults,
      fileTypes,
      minScore
    })
    
    return c.json({
      success: result.success,
      matches: result.matches,
      error: result.error
    })
    
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : '知识库搜索失败'
    }, 500)
  }
})

app.delete('/api/knowledge/:fileId', async (c) => {
  try {
    const fileId = c.req.param('fileId')
    
    const ragService = new RAGService(c.env)
    const result = await ragService.removeFromKnowledgeBase(fileId)
    
    return c.json({
      success: result.success,
      error: result.error
    })
    
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : '从知识库删除文件失败'
    }, 500)
  }
})

app.get('/api/health', (c) => {
  const hasAnyApiKey = !!(c.env.OPENAI_API_KEY || c.env.ANTHROPIC_API_KEY || c.env.GEMINI_API_KEY || c.env.QWEN_API_KEY)
  
  const hasR2 = !!c.env.R2
  const hasPinecone = !!(c.env.PINECONE_API_KEY && c.env.PINECONE_INDEX_URL)
  
  return c.json({ 
    status: 'ok', 
    message: 'Bridge Agent API is running',
    environment: c.env.ENVIRONMENT || 'unknown',
    services: {
      ai: hasAnyApiKey,
      storage: hasR2,
      parsing: true,
      rag: hasPinecone,
      vector: hasPinecone
    },
    availableModels: {
      gpt: !!c.env.OPENAI_API_KEY,
      claude: !!c.env.ANTHROPIC_API_KEY,
      gemini: !!c.env.GEMINI_API_KEY,
      qwen: !!c.env.QWEN_API_KEY
    },
    supportedFormats: ['pdf', 'ifc', 'dxf'],
    features: {
      ragEnabled: hasPinecone,
      knowledgeBase: hasPinecone,
      semanticSearch: hasPinecone
    }
  })
})

// File upload API - 真实文件上传和解析
app.post('/api/upload', async (c) => {
  try {
    const formData = await c.req.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return c.json({ success: false, error: '没有找到上传的文件' }, 400)
    }

    // 验证文件类型
    const allowedTypes = ['pdf', 'ifc', 'dxf']
    const fileType = file.name.toLowerCase().split('.').pop()
    
    if (!fileType || !allowedTypes.includes(fileType)) {
      return c.json({ 
        success: false, 
        error: '不支持的文件类型，请上传PDF、IFC或DXF文件' 
      }, 400)
    }

    // 验证文件大小（限制100MB）
    if (file.size > 100 * 1024 * 1024) {
      return c.json({ 
        success: false, 
        error: '文件大小超过100MB限制' 
      }, 400)
    }

    // 初始化服务
    const storageService = new StorageService(c.env)
    const parsingService = new FileParsingService(c.env)

    // 上传文件到R2存储
    const uploadResult = await storageService.uploadFile(file, {
      userId: 'anonymous', // 实际应用中从认证中获取
      projectId: 'default'
    })

    if (!uploadResult.success) {
      return c.json({ 
        success: false, 
        error: uploadResult.error || '文件上传失败' 
      }, 500)
    }

    // 解析文件内容
    const parsingResult = await parsingService.parseFile(file)
    
    if (!parsingResult.success) {
      console.error('文件解析失败:', parsingResult.error)
      // 即使解析失败，也返回上传成功，但标记解析状态
    }

    return c.json({
      success: true,
      message: '文件上传成功',
      fileId: uploadResult.key,
      fileUrl: uploadResult.url,
      fileName: file.name,
      fileType: fileType,
      fileSize: file.size,
      parsing: {
        success: parsingResult.success,
        content: parsingResult.content,
        error: parsingResult.error
      }
    })

  } catch (error) {
    console.error('Upload API error:', error)
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '上传服务出现未知错误' 
    }, 500)
  }
})

// Chat API - 集成RAG智能问答
app.post('/api/chat', async (c) => {
  try {
    const { message, model, history = [], useRAG = true } = await c.req.json()
    
    if (!message || typeof message !== 'string') {
      return c.json({ success: false, error: '消息内容不能为空' }, 400)
    }

    // 初始化服务
    const ragService = new RAGService(c.env)
    
    let response: any;
    
    if (useRAG) {
      // 使用RAG系统回答
      const conversationHistory: AIMessage[] = history.map((h: any) => ({
        role: h.role as 'user' | 'assistant',
        content: h.content
      }));
      
      const ragResult = await ragService.askQuestion(message, model, {
        maxSources: 5,
        minRelevanceScore: 0.7,
        conversationHistory
      });
      
      response = {
        success: ragResult.success,
        response: ragResult.answer,
        model: ragResult.model,
        sources: ragResult.sources,
        error: ragResult.error,
        ragEnabled: true
      };
    } else {
      // 直接使用AI模型
      const aiService = new AIService(c.env)
      
      const messages: AIMessage[] = [
        ...history.map((h: any) => ({
          role: h.role as 'user' | 'assistant',
          content: h.content
        })),
        {
          role: 'user' as const,
          content: aiService.enhanceBridgeQuery(message)
        }
      ]
      
      const aiResponse = await aiService.chat(messages, model)
      
      response = {
        success: aiResponse.success,
        response: aiResponse.response,
        model: aiResponse.model,
        usage: aiResponse.usage,
        error: aiResponse.error,
        ragEnabled: false
      };
    }
    
    if (!response.success) {
      return c.json({ 
        success: false, 
        error: response.error || 'AI服务调用失败',
        model: response.model
      }, 500)
    }
    
    return c.json(response)
  } catch (error) {
    console.error('Chat API error:', error)
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Chat服务出现未知错误'
    }, 500)
  }
})

// File processing API - 批量处理已上传的文件
app.post('/api/process', async (c) => {
  try {
    const { fileIds, options = {} } = await c.req.json()
    
    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return c.json({ success: false, error: '请提供要处理的文件ID列表' }, 400)
    }

    const storageService = new StorageService(c.env)
    const parsingService = new FileParsingService(c.env)
    const aiService = new AIService(c.env)
    
    const processingResults = []
    const processingId = 'proc-' + Date.now()
    
    for (const fileId of fileIds) {
      try {
        // 从存储获取文件
        const fileObject = await storageService.getFile(fileId)
        
        if (!fileObject) {
          processingResults.push({
            fileId,
            success: false,
            error: '文件未找到'
          })
          continue
        }

        // 重新解析文件（如果需要）
        const fileName = fileObject.customMetadata?.originalName || fileId
        const fileBuffer = await fileObject.arrayBuffer()
        const file = new File([fileBuffer], fileName)
        
        const parsingResult = await parsingService.parseFile(file)
        
        if (parsingResult.success && parsingResult.content) {
          // 增强内容处理
          const enhancedContent = parsingService.enhanceContentForBridge(
            parsingResult.content, 
            parsingResult.fileType
          )
          
          // 添加到知识库（如果配置了向量数据库）
          let vectorResult = null;
          if (c.env.PINECONE_API_KEY && enhancedContent.text) {
            const ragService = new RAGService(c.env)
            vectorResult = await ragService.addToKnowledgeBase(
              fileId,
              parsingResult.fileName,
              parsingResult.fileType,
              enhancedContent.text,
              enhancedContent.metadata
            )
          }
          
          processingResults.push({
            fileId,
            success: true,
            fileName: parsingResult.fileName,
            fileType: parsingResult.fileType,
            content: enhancedContent,
            metadata: fileObject.customMetadata,
            vectorStorage: vectorResult
          })
        } else {
          processingResults.push({
            fileId,
            success: false,
            error: parsingResult.error
          })
        }
        
      } catch (error) {
        processingResults.push({
          fileId,
          success: false,
          error: error instanceof Error ? error.message : '处理失败'
        })
      }
    }
    
    return c.json({
      success: true,
      message: '文件处理完成',
      processingId,
      results: processingResults,
      summary: {
        total: fileIds.length,
        successful: processingResults.filter(r => r.success).length,
        failed: processingResults.filter(r => !r.success).length
      }
    })
    
  } catch (error) {
    console.error('Processing API error:', error)
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '处理服务出现未知错误' 
    }, 500)
  }
})

export default app
