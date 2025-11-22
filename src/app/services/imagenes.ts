// src/app/services/imagenes.service.ts

import { Injectable } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { SupabaseService } from './supabase';

export interface ImageResult {
  url: string;
  blob: Blob;
}

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ImagenesService {

  constructor(private supabaseService: SupabaseService) {}

  async capturarFoto(
    source: 'camera' | 'gallery',
    compressOptions?: CompressOptions
  ): Promise<ImageResult> {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos
      });

      if (!image.dataUrl) {
        throw new Error('No se pudo obtener la imagen');
      }

      const blob = await this.comprimirImagen(
        image.dataUrl,
        compressOptions?.maxWidth || 1024,
        compressOptions?.maxHeight || 1024,
        compressOptions?.quality || 0.7
      );

      // Crear nueva URL desde el blob comprimido
      const blobUrl = URL.createObjectURL(blob);

      return {
        url: blobUrl, // Usar la URL del blob en lugar del dataUrl original
        blob: blob
      };
    } catch (error) {
      console.error('Error al capturar foto:', error);
      throw new Error('Error al capturar la foto');
    }
  }

  async comprimirImagen(
    base64: string,
    maxWidth: number = 1024,
    maxHeight: number = 1024,
    quality: number = 0.7
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        try {
          let width = img.width;
          let height = img.height;

          // Calcular nuevas dimensiones manteniendo aspect ratio
          if (width > maxWidth || height > maxHeight) {
            const aspectRatio = width / height;

            if (width > height) {
              width = maxWidth;
              height = Math.round(width / aspectRatio);
            } else {
              height = maxHeight;
              width = Math.round(height * aspectRatio);
            }
          }

          // Crear canvas
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d', { alpha: false });
          if (!ctx) {
            reject(new Error('No se pudo obtener el contexto del canvas'));
            return;
          }

          // Fondo blanco para JPEGs (evita transparencias)
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);

          // Dibujar imagen
          ctx.drawImage(img, 0, 0, width, height);

          // Convertir a blob
          canvas.toBlob(
            (blob) => {
              if (blob) {
                console.log('Imagen comprimida exitosamente:', {
                  dimensionesOriginales: `${img.width}x${img.height}`,
                  dimensionesNuevas: `${width}x${height}`,
                  tamañoFinal: `${(blob.size / 1024 / 1024).toFixed(2)} MB`,
                  tipo: blob.type
                });
                resolve(blob);
              } else {
                reject(new Error('Error al crear el blob'));
              }
            },
            'image/jpeg',
            quality
          );
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => {
        reject(new Error('Error al cargar la imagen'));
      };

      img.src = base64;
    });
  }

  base64ToBlob(base64: string, contentType: string = 'image/jpeg'): Blob {
    try {
      const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;

      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);

      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }

      const byteArray = new Uint8Array(byteNumbers);
      return new Blob([byteArray], { type: contentType });
    } catch (error) {
      console.error('Error al convertir base64 a blob:', error);
      throw new Error('Error al procesar la imagen');
    }
  }

  async subirImagen(
    bucket: string,
    fileName: string,
    blob: Blob
  ): Promise<{ success: boolean; url?: string; message: string }> {
    return await this.supabaseService.subirImagen(bucket, fileName, blob);
  }

  async capturarYSubirFoto(
    source: 'camera' | 'gallery',
    bucket: string,
    fileName: string,
    compressOptions?: CompressOptions
  ): Promise<{ success: boolean; url?: string; message: string; blob?: Blob }> {
    try {
      const imageResult = await this.capturarFoto(source, compressOptions);

      const uploadResult = await this.subirImagen(bucket, fileName, imageResult.blob);

      return {
        ...uploadResult,
        blob: imageResult.blob
      };
    } catch (error) {
      console.error('Error al capturar y subir foto:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error al procesar la foto'
      };
    }
  }

  async generarQRCode(
    content: string,
    QRCode: any,
    size: number = 512
  ): Promise<Blob> {
    try {
      // Generar QR como data URL
      const qrDataUrl = await QRCode.toDataURL(content, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        width: size,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      // Convertir a blob usando canvas para asegurar formato correcto
      return new Promise((resolve, reject) => {
        const img = new Image();
        
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('No se pudo obtener contexto del canvas'));
            return;
          }
          
          ctx.drawImage(img, 0, 0, size, size);
          
          canvas.toBlob((blob) => {
            if (blob) {
              console.log('QR Code generado:', {
                tamaño: `${size}x${size}`,
                tamañoArchivo: `${(blob.size / 1024).toFixed(2)} KB`,
                tipo: blob.type
              });
              resolve(blob);
            } else {
              reject(new Error('Error al crear blob del QR'));
            }
          }, 'image/png', 1.0);
        };
        
        img.onerror = () => {
          reject(new Error('Error al cargar imagen del QR'));
        };
        
        img.src = qrDataUrl;
      });
    } catch (error) {
      console.error('Error al generar código QR:', error);
      throw new Error('No se pudo generar el código QR');
    }
  }
}