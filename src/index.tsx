import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'

type Bindings = {
  DB?: D1Database;
  KV?: KVNamespace;
  R2?: R2Bucket;
  AI?: any;
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
                    <div class="bg-white rounded-xl shadow-lg p-6">
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
                </div>
            </div>
        </div>

        <!-- Scripts -->
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/app.js"></script>
    </body>
    </html>
  `)
})

// API Routes
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', message: 'Bridge Agent API is running' })
})

// File upload API
app.post('/api/upload', async (c) => {
  try {
    // This would integrate with file processing services
    return c.json({ 
      success: true, 
      message: 'File uploaded successfully',
      fileId: 'temp-id-' + Date.now()
    })
  } catch (error) {
    return c.json({ success: false, error: 'Upload failed' }, 500)
  }
})

// Chat API
app.post('/api/chat', async (c) => {
  try {
    const { message, model } = await c.req.json()
    
    // This would integrate with selected LLM APIs
    const response = `[${model}] 我收到了您的消息: "${message}"。目前这是一个演示响应。在完整实现中，这里将连接到真实的AI模型进行桥梁相关的专业回答。`
    
    return c.json({ 
      success: true, 
      response,
      model 
    })
  } catch (error) {
    return c.json({ success: false, error: 'Chat failed' }, 500)
  }
})

// File processing API
app.post('/api/process', async (c) => {
  try {
    const { fileIds } = await c.req.json()
    
    // This would integrate with file processing pipeline
    return c.json({ 
      success: true, 
      message: 'Processing started',
      processingId: 'proc-' + Date.now()
    })
  } catch (error) {
    return c.json({ success: false, error: 'Processing failed' }, 500)
  }
})

export default app
