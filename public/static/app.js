// Bridge Agent Frontend JavaScript

class BridgeAgent {
    constructor() {
        this.uploadedFiles = {
            pdf: null,
            ifc: null,
            dxf: null
        };
        this.chatHistory = [];
        this.processingResults = [];
        this.availableModels = {
            gpt: false,
            claude: false,
            gemini: false,
            qwen: false
        };
        this.init();
    }

    init() {
        this.checkAPIStatus();
        this.setupFileUploads();
        this.setupChat();
        this.setupProcessing();
        this.setupRAG();
        this.init3D();
    }

    async checkAPIStatus() {
        try {
            const response = await axios.get('/api/health');
            const data = response.data;
            
            if (data.availableModels) {
                this.availableModels = data.availableModels;
                this.updateModelSelection();
            }
            
            // 检查RAG功能
            if (data.features && data.features.ragEnabled) {
                this.ragEnabled = true;
                this.loadKnowledgeBaseStatus();
            }
            
            // 显示API配置状态
            let statusMessage = '';
            if (!data.services.ai) {
                statusMessage = '⚠️ AI API未配置，目前使用模拟模式。';
            } else {
                statusMessage = '🤖 AI服务已正常启动。';
            }
            
            if (data.services.rag) {
                statusMessage += '\n📚 RAG知识库已启用，可以基于上传文档进行智能问答。';
            } else {
                statusMessage += '\n⚠️ RAG知识库未配置，将使用通用AI回答。';
            }
            
            this.addChatMessage('system', statusMessage);
        } catch (error) {
            console.error('API status check failed:', error);
            this.addChatMessage('system', '⚠️ API状态检查失败，请检查网络连接。');
        }
    }

    updateModelSelection() {
        const modelInputs = document.querySelectorAll('input[name="model"]');
        modelInputs.forEach(input => {
            const model = input.value;
            const label = input.closest('label');
            
            if (this.availableModels[model]) {
                input.disabled = false;
                label.style.opacity = '1';
                label.title = '此模型已配置可用';
            } else {
                input.disabled = true;
                label.style.opacity = '0.5';
                label.title = '此模型未配置API密钥';
            }
        });
        
        // 选择第一个可用的模型
        const availableModel = Object.keys(this.availableModels).find(model => this.availableModels[model]);
        if (availableModel) {
            const input = document.querySelector(`input[name="model"][value="${availableModel}"]`);
            if (input) input.checked = true;
        }
    }

    setupFileUploads() {
        // PDF Upload
        const pdfUpload = document.getElementById('pdf-upload');
        const pdfInput = document.getElementById('pdf-input');
        
        pdfUpload.addEventListener('click', () => pdfInput.click());
        pdfInput.addEventListener('change', (e) => this.handleFileUpload(e, 'pdf'));
        
        // IFC Upload
        const ifcUpload = document.getElementById('ifc-upload');
        const ifcInput = document.getElementById('ifc-input');
        
        ifcUpload.addEventListener('click', () => ifcInput.click());
        ifcInput.addEventListener('change', (e) => this.handleFileUpload(e, 'ifc'));
        
        // DXF Upload
        const dxfUpload = document.getElementById('dxf-upload');
        const dxfInput = document.getElementById('dxf-input');
        
        dxfUpload.addEventListener('click', () => dxfInput.click());
        dxfInput.addEventListener('change', (e) => this.handleFileUpload(e, 'dxf'));

        // Drag and drop
        [pdfUpload, ifcUpload, dxfUpload].forEach((element, index) => {
            const types = ['pdf', 'ifc', 'dxf'];
            
            element.addEventListener('dragover', (e) => {
                e.preventDefault();
                element.classList.add('bg-blue-50');
            });
            
            element.addEventListener('dragleave', (e) => {
                e.preventDefault();
                element.classList.remove('bg-blue-50');
            });
            
            element.addEventListener('drop', (e) => {
                e.preventDefault();
                element.classList.remove('bg-blue-50');
                const files = Array.from(e.dataTransfer.files);
                if (files.length > 0) {
                    this.handleFileUpload({ target: { files } }, types[index]);
                }
            });
        });
    }

    async handleFileUpload(event, type) {
        const file = event.target.files[0];
        if (!file) return;

        console.log(`Uploading ${type} file:`, file.name);
        
        try {
            // Visual feedback
            const uploadArea = document.getElementById(`${type}-upload`);
            uploadArea.innerHTML = `
                <div class="text-center">
                    <i class="fas fa-spinner fa-spin text-blue-500 text-3xl mb-2"></i>
                    <p class="text-sm font-medium text-gray-700">正在上传 ${file.name}...</p>
                </div>
            `;

            // Simulate upload (replace with actual upload logic)
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            this.uploadedFiles[type] = file;
            
            // Success feedback
            uploadArea.innerHTML = `
                <div class="text-center">
                    <i class="fas fa-check-circle text-green-500 text-3xl mb-2"></i>
                    <p class="text-sm font-medium text-gray-700">${file.name}</p>
                    <p class="text-xs text-green-600">上传成功</p>
                </div>
            `;
            
            this.checkProcessButton();
            
        } catch (error) {
            console.error('Upload failed:', error);
            // Error feedback
            const uploadArea = document.getElementById(`${type}-upload`);
            uploadArea.innerHTML = `
                <div class="text-center">
                    <i class="fas fa-exclamation-circle text-red-500 text-3xl mb-2"></i>
                    <p class="text-sm font-medium text-gray-700">上传失败</p>
                    <p class="text-xs text-red-600">请重试</p>
                </div>
            `;
        }
    }

    checkProcessButton() {
        const hasFiles = Object.values(this.uploadedFiles).some(file => file !== null);
        const processBtn = document.getElementById('process-btn');
        
        if (hasFiles) {
            processBtn.disabled = false;
            processBtn.innerHTML = '<i class="fas fa-cog mr-2"></i>开始处理文件';
        } else {
            processBtn.disabled = true;
            processBtn.innerHTML = '<i class="fas fa-upload mr-2"></i>请先上传文件';
        }
    }

    setupProcessing() {
        const processBtn = document.getElementById('process-btn');
        processBtn.addEventListener('click', () => this.processFiles());
    }

    async processFiles() {
        const uploadedFilesList = Object.values(this.uploadedFiles).filter(file => file !== null);
        if (uploadedFilesList.length === 0) {
            alert('请先上传至少一个文件');
            return;
        }

        const progressPanel = document.getElementById('progress-panel');
        progressPanel.style.display = 'block';

        try {
            // Show processing steps
            await this.simulateProcessingSteps();
            
            // Add success message to chat
            this.addChatMessage('system', '文件处理完成！您现在可以开始与桥梁智能体对话了。');
            
        } catch (error) {
            console.error('Processing failed:', error);
            this.addChatMessage('system', '文件处理失败，请检查文件格式并重试。');
        }
    }

    async simulateProcessingSteps() {
        const steps = [
            { id: 'upload-status', icon: 'fas fa-check', color: 'text-green-500' },
            { id: 'parse-status', icon: 'fas fa-check', color: 'text-green-500' },
            { id: 'extract-status', icon: 'fas fa-check', color: 'text-green-500' },
            { id: 'train-status', icon: 'fas fa-check', color: 'text-green-500' }
        ];

        for (let i = 0; i < steps.length; i++) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const element = document.getElementById(steps[i].id);
            element.className = steps[i].icon + ' ' + steps[i].color;
        }
    }

    setupChat() {
        const chatInput = document.getElementById('chat-input');
        const sendBtn = document.getElementById('send-btn');
        
        sendBtn.addEventListener('click', () => this.sendMessage());
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });
    }

    async sendMessage() {
        const chatInput = document.getElementById('chat-input');
        const message = chatInput.value.trim();
        
        if (!message) return;
        
        // Get selected model
        const selectedModel = document.querySelector('input[name="model"]:checked').value;
        
        // Add user message to chat
        this.addChatMessage('user', message);
        chatInput.value = '';
        
        // Add loading message
        const loadingId = this.addChatMessage('assistant', '正在思考中...', true);
        
        try {
            const response = await axios.post('/api/chat', {
                message,
                model: selectedModel
            });
            
            // Remove loading message and add response
            document.getElementById(loadingId).remove();
            this.addChatMessage('assistant', response.data.response);
            
        } catch (error) {
            console.error('Chat error:', error);
            document.getElementById(loadingId).remove();
            this.addChatMessage('assistant', '抱歉，发生了错误，请重试。');
        }
    }

    addChatMessage(sender, message, isLoading = false) {
        const chatMessages = document.getElementById('chat-messages');
        const messageId = 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        
        const isUser = sender === 'user';
        const messageDiv = document.createElement('div');
        messageDiv.id = messageId;
        messageDiv.className = 'flex items-start mb-4';
        
        if (isUser) {
            messageDiv.innerHTML = `
                <div class="bg-blue-500 text-white p-2 rounded-full ml-auto mr-3 order-2">
                    <i class="fas fa-user"></i>
                </div>
                <div class="bg-gray-100 p-3 rounded-lg flex-1 order-1">
                    <p class="text-sm text-gray-800">${message}</p>
                </div>
            `;
        } else {
            messageDiv.innerHTML = `
                <div class="bg-green-500 text-white p-2 rounded-full mr-3">
                    <i class="fas fa-robot"></i>
                </div>
                <div class="bg-green-50 p-3 rounded-lg flex-1">
                    <p class="text-sm text-gray-800">${isLoading ? '<i class="fas fa-spinner fa-spin mr-2"></i>' + message : message}</p>
                </div>
            `;
        }
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        return messageId;
    }
    
    setupRAG() {
        const ragToggle = document.getElementById('rag-toggle');
        const refreshBtn = document.getElementById('refresh-kb-btn');
        
        if (ragToggle) {
            ragToggle.addEventListener('change', (e) => {
                this.handleRAGToggle(e.target.checked);
            });
        }
        
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.loadKnowledgeBaseStatus();
            });
        }
    }
    
    handleRAGToggle(enabled) {
        const kbPanel = document.getElementById('kb-status-panel');
        
        if (enabled && this.ragEnabled) {
            kbPanel.style.display = 'block';
            this.loadKnowledgeBaseStatus();
            this.addChatMessage('system', '📚 RAG知识库已启用，将优先使用已上传的文档内容回答问题。');
        } else {
            kbPanel.style.display = 'none';
            if (enabled && !this.ragEnabled) {
                this.addChatMessage('system', '⚠️ RAG知识库未配置，将使用通用AI回答。');
            } else {
                this.addChatMessage('system', 'ℹ️ 已关闭RAG功能，将使用通用AI回答。');
            }
        }
    }
    
    async loadKnowledgeBaseStatus() {
        const contentDiv = document.getElementById('kb-status-content');
        
        try {
            contentDiv.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>正在加载...';
            
            const response = await axios.get('/api/knowledge/status');
            
            if (response.data.success) {
                const status = response.data.status;
                const summary = response.data.summary;
                
                contentDiv.innerHTML = `
                    <div class="space-y-2">
                        <div class="text-sm">
                            <strong>📊 知识库统计:</strong>
                        </div>
                        <div class="text-xs space-y-1 ml-4">
                            <div>📝 向量数量: ${status.vectorCount.toLocaleString()}</div>
                            <div>📁 文档数量: ${status.documentCount}</div>
                            <div>📚 PDF规范: ${status.categories.documents}</div>
                            <div>🏢 BIM模型: ${status.categories.models}</div>
                            <div>📏 CAD图纸: ${status.categories.drawings}</div>
                        </div>
                        <div class="text-xs text-gray-500 mt-2">
                            最后更新: ${new Date(status.lastUpdated).toLocaleString('zh-CN')}
                        </div>
                    </div>
                `;
                
                this.knowledgeBaseStatus = status;
            } else {
                contentDiv.innerHTML = `
                    <div class="text-yellow-600">
                        <i class="fas fa-exclamation-triangle mr-2"></i>
                        ${response.data.error || '知识库未配置'}
                    </div>
                `;
            }
            
        } catch (error) {
            console.error('加载知识库状态失败:', error);
            contentDiv.innerHTML = `
                <div class="text-red-600">
                    <i class="fas fa-times-circle mr-2"></i>
                    加载失败: ${error.message || '网络错误'}
                </div>
            `;
        }
    }

    init3D() {
        // Initialize Three.js scene for 3D visualization
        const container = document.getElementById('three-container');
        
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf0f0f0);
        
        // Create camera
        this.camera = new THREE.PerspectiveCamera(75, container.offsetWidth / container.offsetHeight, 0.1, 1000);
        this.camera.position.set(5, 5, 5);
        
        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(container.offsetWidth, container.offsetHeight);
        container.innerHTML = '';
        container.appendChild(this.renderer.domElement);
        
        // Add controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        
        // Add lights
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1, 1);
        this.scene.add(directionalLight);
        
        // Add sample bridge geometry
        this.addSampleBridge();
        
        // Start render loop
        this.animate();
        
        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
    }

    addSampleBridge() {
        // Create a simple bridge structure
        const bridgeGroup = new THREE.Group();
        
        // Bridge deck
        const deckGeometry = new THREE.BoxGeometry(10, 0.5, 3);
        const deckMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const deck = new THREE.Mesh(deckGeometry, deckMaterial);
        deck.position.y = 1;
        bridgeGroup.add(deck);
        
        // Bridge pillars
        const pillarGeometry = new THREE.CylinderGeometry(0.3, 0.3, 2);
        const pillarMaterial = new THREE.MeshLambertMaterial({ color: 0x696969 });
        
        for (let i = -3; i <= 3; i += 3) {
            const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
            pillar.position.set(i, 0, 0);
            bridgeGroup.add(pillar);
        }
        
        // Cables
        const cableGeometry = new THREE.CylinderGeometry(0.05, 0.05, 5);
        const cableMaterial = new THREE.MeshLambertMaterial({ color: 0x404040 });
        
        for (let i = -2; i <= 2; i += 2) {
            const cable = new THREE.Mesh(cableGeometry, cableMaterial);
            cable.position.set(i, 3, 0);
            cable.rotation.z = Math.PI / 4;
            bridgeGroup.add(cable);
        }
        
        this.scene.add(bridgeGroup);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        const container = document.getElementById('three-container');
        if (container && this.camera && this.renderer) {
            this.camera.aspect = container.offsetWidth / container.offsetHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(container.offsetWidth, container.offsetHeight);
        }
    }
}

// Initialize the Bridge Agent when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.bridgeAgent = new BridgeAgent();
});