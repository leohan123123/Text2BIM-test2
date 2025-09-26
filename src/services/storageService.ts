// Storage Service for Cloudflare R2
// 文件存储和管理服务

interface StorageResult {
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
}

interface FileMetadata {
  originalName: string;
  fileType: string;
  size: number;
  uploadDate: string;
  userId?: string;
  projectId?: string;
}

export class StorageService {
  private r2: R2Bucket | undefined;
  
  constructor(env: any) {
    this.r2 = env.R2;
  }

  async uploadFile(file: File, metadata: Partial<FileMetadata> = {}): Promise<StorageResult> {
    if (!this.r2) {
      return {
        success: false,
        error: 'R2存储未配置'
      };
    }

    try {
      // 生成唯一的文件键
      const fileKey = this.generateFileKey(file.name, metadata);
      
      // 准备文件元数据
      const fileMetadata: FileMetadata = {
        originalName: file.name,
        fileType: this.getFileType(file.name),
        size: file.size,
        uploadDate: new Date().toISOString(),
        ...metadata
      };

      // 上传到R2
      await this.r2.put(fileKey, await file.arrayBuffer(), {
        httpMetadata: {
          contentType: file.type || 'application/octet-stream',
          contentDisposition: `attachment; filename="${file.name}"`
        },
        customMetadata: {
          ...fileMetadata,
          size: fileMetadata.size.toString()
        }
      });

      return {
        success: true,
        key: fileKey,
        url: this.getFileUrl(fileKey)
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '文件上传失败'
      };
    }
  }

  async getFile(key: string): Promise<R2ObjectBody | null> {
    if (!this.r2) {
      return null;
    }

    try {
      return await this.r2.get(key);
    } catch (error) {
      console.error('Get file error:', error);
      return null;
    }
  }

  async deleteFile(key: string): Promise<boolean> {
    if (!this.r2) {
      return false;
    }

    try {
      await this.r2.delete(key);
      return true;
    } catch (error) {
      console.error('Delete file error:', error);
      return false;
    }
  }

  async listFiles(prefix?: string, limit: number = 100): Promise<R2Object[]> {
    if (!this.r2) {
      return [];
    }

    try {
      const result = await this.r2.list({
        prefix,
        limit
      });
      return result.objects;
    } catch (error) {
      console.error('List files error:', error);
      return [];
    }
  }

  private generateFileKey(fileName: string, metadata: Partial<FileMetadata>): string {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const extension = fileName.split('.').pop();
    const baseName = fileName.replace(/\\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]/g, '_');
    
    // 构建文件路径
    const prefix = metadata.projectId ? `projects/${metadata.projectId}` : 'uploads';
    const fileType = this.getFileType(fileName);
    
    return `${prefix}/${fileType}/${timestamp}_${randomId}_${baseName}.${extension}`;
  }

  private getFileType(fileName: string): string {
    const extension = fileName.toLowerCase().split('.').pop();
    const typeMap: { [key: string]: string } = {
      'pdf': 'documents',
      'ifc': 'models',
      'dxf': 'drawings',
      'dwg': 'drawings',
      'jpg': 'images',
      'jpeg': 'images',
      'png': 'images',
      'gif': 'images',
      'doc': 'documents',
      'docx': 'documents',
      'txt': 'documents'
    };
    
    return typeMap[extension || ''] || 'others';
  }

  private getFileUrl(key: string): string {
    // 在实际部署中，这将是R2的公共URL
    // 格式: https://your-bucket-name.your-account-id.r2.cloudflarestorage.com/file-key
    return `/api/files/${encodeURIComponent(key)}`;
  }

  // 获取文件的公共访问URL（如果配置了自定义域名）
  getPublicUrl(key: string, customDomain?: string): string {
    if (customDomain) {
      return `https://${customDomain}/${key}`;
    }
    return this.getFileUrl(key);
  }

  // 生成预签名URL用于直接上传（可选功能）
  async generatePresignedUrl(fileName: string, expiresIn: number = 3600): Promise<StorageResult> {
    // 注意：Cloudflare R2目前不支持预签名URL
    // 这里返回一个错误，在实际应用中可以使用其他方案
    return {
      success: false,
      error: 'Cloudflare R2暂不支持预签名URL，请使用直接上传方式'
    };
  }
}

export type { StorageResult, FileMetadata };