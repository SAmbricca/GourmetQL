import { Injectable } from '@angular/core';
import { CapacitorHttp, HttpResponse } from '@capacitor/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CapacitorService {

  constructor() {}

  async capacitorFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    let url: string;
    
    if (typeof input === 'string') {
      url = input;
    } else if (input instanceof URL) {
      url = input.toString();
    } else if (input instanceof Request) {
      url = input.url;
    } else {
      throw new Error('Invalid input type for fetch');
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `${environment.supabaseUrl}${url}`;
    }
    
    try {
      let headers: Record<string, string> = {};
      
      if (init?.headers) {
        if (init.headers instanceof Headers) {
          init.headers.forEach((value, key) => {
            headers[key] = value;
          });
        } else if (Array.isArray(init.headers)) {
          init.headers.forEach(([key, value]) => {
            headers[key] = value;
          });
        } else {
          headers = { ...init.headers as Record<string, string> };
        }
      }

      const options: any = {
        url: url,
        method: init?.method || 'GET',
        headers: headers,
      };

      if (init?.body) {
        if (typeof init.body === 'string') {
          try {
            options.data = JSON.parse(init.body);
          } catch {
            options.data = init.body;
          }
        } else {
          options.data = init.body;
        }
      }

      const response: HttpResponse = await CapacitorHttp.request(options);

      let responseBody: string;
      
      if (response.data === null || response.data === undefined) {
        responseBody = '';
      } else if (typeof response.data === 'string') {
        responseBody = response.data;
      } else {
        responseBody = JSON.stringify(response.data);
      }

      const responseHeaders = new Headers(response.headers || {});
      if (!responseHeaders.has('content-type')) {
        responseHeaders.set('content-type', 'application/json');
      }
      
      return new Response(responseBody, {
        status: response.status,
        statusText: this.getStatusText(response.status),
        headers: responseHeaders
      });
    } catch (error) {
      throw error;
    }
  }

  private getStatusText(status: number): string {
    const statusTexts: Record<number, string> = {
      200: 'OK',
      201: 'Created',
      204: 'No Content',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      500: 'Internal Server Error'
    };
    return statusTexts[status] || 'Unknown';
  }
}