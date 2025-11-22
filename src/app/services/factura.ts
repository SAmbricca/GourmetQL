import { Injectable } from '@angular/core';
import { Platform } from '@ionic/angular';

// Declaramos 'require' para que TypeScript permita la importación dinámica de librerías JS antiguas
declare var require: any;

@Injectable({
  providedIn: 'root'
})
export class FacturaService {
  
  private pdfMake: any;

  constructor(private platform: Platform) { }

  // --- 1. INICIALIZACIÓN DE LA LIBRERÍA ---
  // Se carga bajo demanda para no bloquear el inicio de la app ni causar errores de "chunk load"
  private async initPdfMake() {
    if (this.pdfMake) return; // Si ya está cargada, no hacemos nada

    try {
      const pdfMakeModule = require('pdfmake/build/pdfmake');
      const pdfFontsModule = require('pdfmake/build/vfs_fonts');

      // Lógica defensiva para asignar las fuentes (vfs) dependiendo de cómo el empaquetador cargue el módulo
      if (pdfFontsModule && pdfFontsModule.pdfMake && pdfFontsModule.pdfMake.vfs) {
        pdfMakeModule.vfs = pdfFontsModule.pdfMake.vfs;
      } else if (pdfFontsModule && pdfFontsModule.vfs) {
        pdfMakeModule.vfs = pdfFontsModule.vfs;
      } else if (pdfFontsModule && pdfFontsModule.default && pdfFontsModule.default.pdfMake && pdfFontsModule.default.pdfMake.vfs) {
        pdfMakeModule.vfs = pdfFontsModule.default.pdfMake.vfs; 
      }

      this.pdfMake = pdfMakeModule;
    } catch (error) {
      console.error('Error crítico inicializando PDFMake:', error);
      throw new Error('No se pudo cargar el generador de PDF.');
    }
  }

  // --- 2. UTILIDADES ---
  
  // Convierte imágenes locales a Base64 porque PDFMake no lee rutas de assets directas
  private async cargarImagenBase64(ruta: string): Promise<string> {
    try {
      const response = await fetch(ruta);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.warn(`No se pudo cargar la imagen: ${ruta}`, error);
      return ''; // Retornamos cadena vacía para que el PDF se genere igual sin imagen
    }
  }

  // --- 3. LÓGICA CENTRAL ---

  /**
   * Crea el objeto PDF interno de pdfMake (sin renderizar aún).
   * Carga imágenes y define estructura.
   */
  private async crearObjetoPDF(pedido: any): Promise<any> {
    await this.initPdfMake();
    
    // Carga paralela de imágenes
    const [logoBase64, fondoBase64] = await Promise.all([
      this.cargarImagenBase64('assets/logo.png'),
      this.cargarImagenBase64('assets/fondo.png')
    ]);

    const docDefinition = this.crearDefinicionPDF(pedido, logoBase64, fondoBase64);
    return this.pdfMake.createPdf(docDefinition);
  }

  /**
   * Genera y devuelve el archivo BLOB (Binario).
   * Esencial para adjuntar el PDF al correo electrónico.
   */
  async generarPDFBlob(pedido: any): Promise<Blob> {
    const pdfObj = await this.crearObjetoPDF(pedido);
    
    return new Promise((resolve) => {
      pdfObj.getBlob((blob: Blob) => {
        resolve(blob);
      });
    });
  }

  async abrirFactura(pedido: any): Promise<void> {
    const pdfObj = await this.crearObjetoPDF(pedido);

    if (this.platform.is('capacitor') || this.platform.is('android') || this.platform.is('ios')) {
      // En móviles, descargamos el archivo. El usuario deberá abrirlo desde descargas/notificaciones.
      pdfObj.download(`factura-mesa-${pedido.mesa.numero}.pdf`);
    } else {
      // En Web (Escritorio), es seguro abrir en nueva pestaña
      pdfObj.open();
    }
  }

  // --- 4. DISEÑO DEL DOCUMENTO ---
  private crearDefinicionPDF(pedido: any, logoBase64: string, fondoBase64: string): any {
    // Mapeamos los detalles del pedido a filas de la tabla
    const items = pedido.detalles.map((detalle: any) => {
      return [
        detalle.menu.nombre,
        detalle.cantidad,
        `$${detalle.menu.precio}`,
        `$${detalle.cantidad * detalle.menu.precio}`
      ];
    });

    // Cálculos de totales
    const subtotal = pedido.detalles.reduce((acc: number, el: any) => acc + (el.cantidad * el.menu.precio), 0);
    const descuento = pedido.descuento || 0;
    const propina = pedido.propina || 0;
    const total = pedido.total || (subtotal - descuento + propina);

    return {
      // Marca de agua de fondo
      background: (currentPage: number, pageSize: any) => {
        return fondoBase64 ? { 
          image: fondoBase64, 
          width: pageSize.width, 
          height: pageSize.height, 
          opacity: 0.1 // Muy transparente
        } : null;
      },
      content: [
        // Encabezado
        {
          columns: [
            { image: logoBase64, width: 60, margin: [0, 0, 0, 10] },
            {
              text: [ 
                { text: 'RESTO APP\n', style: 'headerTitle' }, 
                { text: 'Av. Siempreviva 742\nSpringfield', style: 'subHeader' } 
              ],
              alignment: 'left', margin: [10, 0, 0, 0]
            },
            {
              text: [ 
                { text: 'FACTURA C\n', style: 'headerTitle', alignment: 'right' }, 
                { text: `Fecha: ${new Date().toLocaleDateString()}`, alignment: 'right' },
                { text: `Pedido #: ${pedido.id}`, alignment: 'right', fontSize: 10 }
              ],
              width: '*'
            }
          ]
        },
        // Línea divisoria
        { canvas: [{ type: 'line', x1: 0, y1: 10, x2: 515, y2: 10, lineWidth: 1, lineColor: '#cc480b' }], margin: [0, 10, 0, 20] },
        
        // Datos del Cliente y Mesa
        {
          style: 'sectionContainer',
          columns: [
            {
              width: '*',
              text: [
                { text: 'CLIENTE:\n', bold: true, color: '#cc480b' },
                pedido.cliente ? `${pedido.cliente.nombre} ${pedido.cliente.apellido}\n` : (pedido.cliente_anonimo?.nombre || 'Consumidor Final\n'),
                pedido.cliente?.email ? `Email: ${pedido.cliente.email}` : ''
              ]
            },
            {
              width: 'auto',
              text: [ 
                { text: 'MESA\n', bold: true, color: '#cc480b', alignment: 'center' }, 
                { text: `${pedido.mesa.numero}`, fontSize: 18, bold: true, alignment: 'center' } 
              ]
            }
          ]
        },
        
        { text: '', margin: [0, 0, 0, 15] },
        
        // Tabla de productos
        {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto', 'auto'],
            body: [
              [ 
                { text: 'DESCRIPCIÓN', style: 'tableHeader' }, 
                { text: 'CANT.', style: 'tableHeader', alignment: 'center' }, 
                { text: 'UNITARIO', style: 'tableHeader', alignment: 'right' }, 
                { text: 'IMPORTE', style: 'tableHeader', alignment: 'right' } 
              ],
              ...items
            ]
          },
          layout: { 
            fillColor: (i: number) => (i === 0) ? '#cc480b' : (i % 2 === 0) ? '#f3f3f3' : null, 
            hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length) ? 0 : 1, 
            vLineWidth: () => 0, 
            hLineColor: () => '#dddddd' 
          }
        },
        
        // Sección de Totales
        {
          margin: [0, 20, 0, 0],
          columns: [
            { width: '*', text: '' }, 
            {
              width: 220,
              table: {
                widths: ['*', 'auto'],
                body: [
                  [{ text: 'Subtotal', style: 'totalLabel' }, { text: `$${subtotal}`, style: 'totalValue' }],
                  // Solo mostramos descuento si existe
                  descuento > 0 ? [{ text: 'Descuento', style: 'totalLabel', color: 'green' }, { text: `- $${descuento}`, style: 'totalValue', color: 'green' }] : [],
                  // Solo mostramos propina si existe
                  propina > 0 ? [{ text: 'Propina', style: 'totalLabel' }, { text: `$${propina}`, style: 'totalValue' }] : [],
                  
                  [{ colSpan: 2, canvas: [{ type: 'line', x1: 0, y1: 5, x2: 220, y2: 5, lineWidth: 1 }] }, {}],
                  
                  [{ text: 'TOTAL', style: 'totalBigLabel' }, { text: `$${total}`, style: 'totalBigValue' }]
                ].filter(row => row.length > 0) // Filtramos filas vacías
              },
              layout: 'noBorders'
            }
          ]
        },
        // Pie de página
        { text: '¡Gracias por elegirnos!', style: 'footer', alignment: 'center', margin: [0, 40, 0, 0] }
      ],
      // Estilos
      styles: {
        headerTitle: { fontSize: 16, bold: true, color: '#333' },
        subHeader: { fontSize: 10, color: '#555' },
        sectionContainer: { margin: [0, 5, 0, 5] },
        tableHeader: { bold: true, fontSize: 10, color: 'white' },
        totalLabel: { fontSize: 10, bold: true, color: '#555', alignment: 'right' },
        totalValue: { fontSize: 10, color: '#333', alignment: 'right' },
        totalBigLabel: { fontSize: 14, bold: true, color: '#cc480b', alignment: 'right', margin: [0, 5, 0, 0] },
        totalBigValue: { fontSize: 14, bold: true, color: '#cc480b', alignment: 'right', margin: [0, 5, 0, 0] },
        footer: { italics: true, fontSize: 10, color: 'gray' }
      },
      pageSize: 'A4',
      pageMargins: [40, 40, 40, 40]
    };
  }
}