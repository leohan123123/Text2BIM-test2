# 桥梁智能体 (Bridge Agent)

## 项目概述
- **项目名称**: Bridge Agent（桥梁智能体）
- **目标**: 构建一个完整的桥梁智能分析与设计系统，能够解析多种桥梁相关文件（PDF规范、IFC模型、DXF图纸），提取知识并训练专业的桥梁AI智能体
- **主要功能**: 
  - 多格式文件解析（PDF、IFC、DXF）
  - 智能知识提取与处理
  - 多LLM模型集成与对话
  - 3D桥梁模型可视化
  - 专业桥梁设计建议

## 在线访问
- **开发环境**: https://3000-iv3kjltisjdfvh7fnm3pv-6532622b.e2b.dev
- **API健康检查**: https://3000-iv3kjltisjdfvh7fnm3pv-6532622b.e2b.dev/api/health
- **GitHub仓库**: https://github.com/leohan123123/Text2BIM-test2

## 技术架构

### 前端技术栈
- **Web框架**: Hono + Cloudflare Pages
- **UI框架**: TailwindCSS + 原生JavaScript
- **3D可视化**: Three.js
- **图标**: FontAwesome
- **HTTP客户端**: Axios

### 后端架构
- **运行时**: Cloudflare Workers
- **API框架**: Hono
- **文件存储**: Cloudflare R2 + 本地存储
- **数据库**: 准备集成 Cloudflare D1
- **缓存**: Cloudflare KV Store

### 数据架构
- **文件类型支持**: 
  - PDF规范文档（桥梁知识和标准）
  - IFC建筑信息模型（符合IFC标准）
  - DXF CAD图纸（桥梁设计图）
- **知识处理**: 数据清洗、治理、分类、RAG处理、Embedding
- **AI模型集成**: GPT-4o、Claude 3.5、Gemini 2.5、Qwen等

## 当前已实现功能

### ✅ 基础Web界面
- 响应式设计的用户界面
- 文件拖拽上传功能（支持PDF、IFC、DXF）
- 实时处理进度显示
- 智能对话聊天界面

### ✅ 3D可视化
- Three.js 3D场景渲染
- 交互式相机控制（OrbitControls）
- 示例桥梁结构展示（桥面、支柱、拉索）
- 响应式3D视图

### ✅ API接口框架
- `/api/health` - 系统健康检查
- `/api/upload` - 文件上传处理
- `/api/chat` - 智能对话接口
- `/api/process` - 文件处理管道

### ✅ 多模型选择
- GPT-4o（推荐）
- Claude 3.5 Sonnet  
- Gemini 2.5 Pro
- Qwen 2.5

## 待实现功能

### 🔄 正在开发
- 文件上传和处理API的完整实现
- 第三方文件解析服务集成

### ⏳ 计划开发
- **文件解析引擎**:
  - PDF文档内容提取（文字、图表、技术规范）
  - IFC模型解析（建筑信息、几何结构、属性数据）
  - DXF图纸解析（图形元素、标注信息、图层数据）

- **知识处理系统**:
  - 智能数据清洗和预处理
  - 专业桥梁知识分类和标注
  - RAG（检索增强生成）系统构建
  - 向量嵌入和相似性搜索

- **AI训练与推理**:
  - 多LLM模型API集成
  - 桥梁专业知识微调
  - 智能问答和设计建议
  - 自然语言到设计参数转换

- **高级可视化**:
  - 2D桥梁图纸自动生成
  - 3D桥梁模型动态生成
  - 工程图纸标注和渲染
  - 交互式设计修改界面

## 用户使用指南

### 基本操作流程
1. **访问系统**: 打开Web界面
2. **上传文件**: 
   - 拖拽或点击上传PDF规范文档
   - 上传IFC建筑信息模型文件
   - 上传DXF CAD图纸文件
3. **开始处理**: 点击"开始处理文件"按钮
4. **观察进度**: 查看处理进度实时更新
5. **智能对话**: 在聊天界面询问桥梁相关问题
6. **查看结果**: 在3D可视化面板查看生成的模型

### 支持的文件格式
- **PDF**: .pdf（桥梁规范、技术标准、设计手册）
- **IFC**: .ifc（建筑信息模型、BIM文件）
- **DXF**: .dxf（AutoCAD图纸、工程制图）

## 部署状态
- **平台**: Cloudflare Pages
- **状态**: ✅ 开发环境运行中
- **技术栈**: Hono + TypeScript + TailwindCSS + Three.js
- **最后更新**: 2025-09-26

## 开发计划

### 下一阶段目标
1. **集成第三方文件解析API服务**
2. **实现真实的文件处理流程**
3. **集成向量数据库进行知识存储**
4. **连接多个LLM API进行智能对话**
5. **构建专业的桥梁知识库**

### 技术改进方向
- 添加文件类型验证和错误处理
- 实现用户会话管理
- 集成专业的CAD/BIM解析库
- 添加数据库存储桥梁项目
- 实现批量文件处理能力

## 技术支持

### 本地开发
```bash
git clone https://github.com/leohan123123/Text2BIM-test2.git
cd Text2BIM-test2
npm install
npm run build
npm run dev:sandbox
```

### API测试
```bash
curl https://3000-iv3kjltisjdfvh7fnm3pv-6532622b.e2b.dev/api/health
```

---

**项目愿景**: 成为桥梁工程领域最专业、最智能的AI辅助设计平台，帮助工程师提高设计效率，确保桥梁安全性和创新性。