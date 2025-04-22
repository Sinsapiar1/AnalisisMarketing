// Variables globales para almacenar los datos de la última consulta
let ultimaRespuesta = null;

/**
 * Función para generar preguntas clave a través de la API de Gemini
 * Se activa cuando el usuario hace clic en el botón "Generar Preguntas Clave"
 */
function generarPreguntas() {
    // Referencias a elementos del DOM
    const loadingIndicator = document.getElementById('loadingIndicator');
    const initialMessage = document.getElementById('initialMessage');
    const questionsList = document.getElementById('questionsList');
    const exportButtons = document.getElementById('exportButtons');
    const metadata = document.getElementById('metadata');
    const metadataList = document.getElementById('metadataList');
    
    // Obtener valores del formulario
    const nicho = document.getElementById('nicho').value;
    const audiencia = document.getElementById('audiencia').value;
    const ubicacion = document.getElementById('ubicacion').value;
    const plataforma = document.getElementById('plataforma').value;
    
    // Validar campos requeridos
    if (!nicho || !audiencia) {
        alert('Por favor, completa los campos obligatorios (Nicho y Audiencia).');
        return;
    }
    
    // Preparar datos para enviar al backend
    const datos = {
        nicho: nicho,
        audiencia: audiencia,
        ubicacion: ubicacion,
        plataforma: plataforma
    };
    
    // Mostrar indicador de carga y ocultar elementos
    loadingIndicator.style.display = 'flex';
    initialMessage.style.display = 'none';
    questionsList.innerHTML = ''; // Limpiar lista de preguntas anteriores
    exportButtons.style.display = 'none';
    metadata.style.display = 'none';
    
    console.log('Enviando datos al servidor:', datos);
    
    // URL del backend principal (rutas relativas para Render)
    const backendUrl = '/generar_preguntas_gemini';
    
    // Verificar conexión con el servidor
    fetch('/test')
        .then(response => {
            if (response.ok) {
                console.log('Servidor en línea, procediendo con la solicitud principal');
                return response.json();
            } else {
                throw new Error('El servidor no está respondiendo correctamente');
            }
        })
        .then(testData => {
            console.log('Información del modelo:', testData.model_info);
            realizarPeticionPrincipal();
        })
        .catch(error => {
            console.error('Error al verificar el servidor:', error);
            loadingIndicator.style.display = 'none';
            initialMessage.textContent = `Error: No se puede conectar con el servidor. Asegúrate de que el servidor esté en ejecución.`;
            initialMessage.style.display = 'block';
        });
        
    // Función para realizar la petición principal
    function realizarPeticionPrincipal() {
        // Realizar petición al backend
        fetch(backendUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(datos)
        })
        .then(response => {
            console.log('Respuesta del servidor:', response.status);
            // Verificar si la respuesta es exitosa
            if (!response.ok) {
                return response.json().then(errorData => {
                    if (response.status === 500 && errorData.error && 
                        (errorData.error.includes('API de Gemini') || 
                         errorData.error.includes('modelo') || 
                         errorData.error.includes('generar contenido'))) {
                        console.log('Error con la API de Gemini, intentando con método alternativo');
                        return usarMetodoAlternativo();
                    }
                    throw new Error(`Error del servidor: ${response.status}. Detalles: ${errorData.error || 'Sin detalles'}`);
                });
            }
            return response.json();
        })
        .then(data => {
            // Guardar la respuesta para uso posterior (exportación)
            ultimaRespuesta = data;
            
            // Ocultar indicador de carga
            loadingIndicator.style.display = 'none';
            
            console.log('Datos recibidos:', data);
            
            // Procesar respuesta exitosa
            if (data.preguntas && data.preguntas.length > 0) {
                // Mostrar botones de exportación
                exportButtons.style.display = 'flex';
                
                // Mostrar cada pregunta
                mostrarPreguntas(data.preguntas);
                
                // Mostrar metadatos
                if (data.metadatos) {
                    mostrarMetadatos(data.metadatos);
                }
            } else {
                // Mostrar mensaje si no hay preguntas
                initialMessage.textContent = 'No se pudieron generar preguntas. Intenta con un nicho diferente.';
                initialMessage.style.display = 'block';
            }
        })
        .catch(error => {
            // Manejar errores
            console.error('Error:', error);
            loadingIndicator.style.display = 'none';
            initialMessage.textContent = `${error.message}. Por favor, intenta de nuevo.`;
            initialMessage.style.display = 'block';
        });
    }
    
    // Función para usar el método alternativo si falla la API de Gemini
    function usarMetodoAlternativo() {
        console.log('Usando método alternativo para generar preguntas');
        
        return fetch('/generar_preguntas_basicas', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(datos)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error del servidor alternativo: ${response.status}`);
            }
            return response.json();
        });
    }
}

/**
 * Función para mostrar las preguntas en la interfaz
 */
function mostrarPreguntas(preguntas) {
    const questionsList = document.getElementById('questionsList');
    questionsList.innerHTML = ''; // Limpiar contenido anterior
    
    preguntas.forEach(pregunta => {
        const questionItem = document.createElement('div');
        questionItem.className = 'question-item';
        
        // Crear estructura HTML para la pregunta
        let questionHTML = '';
        
        // Añadir título si existe
        if (pregunta.titulo) {
            questionHTML += `<span class="question-title">${pregunta.titulo}</span>`;
        }
        
        // Añadir pregunta
        questionHTML += `<span class="question-text">${pregunta.pregunta}</span>`;
        
        // Añadir contexto si existe
        if (pregunta.contexto) {
            questionHTML += `<span class="question-context">${pregunta.contexto}</span>`;
        }
        
        questionItem.innerHTML = questionHTML;
        questionsList.appendChild(questionItem);
    });
}

/**
 * Función para mostrar los metadatos de la consulta
 */
function mostrarMetadatos(metadatos) {
    const metadata = document.getElementById('metadata');
    const metadataList = document.getElementById('metadataList');
    
    // Limpiar lista de metadatos
    metadataList.innerHTML = '';
    
    // Añadir cada metadato a la lista
    for (const [clave, valor] of Object.entries(metadatos)) {
        const metadataItem = document.createElement('li');
        
        // Formatear nombre de la clave
        let nombreClave = clave.charAt(0).toUpperCase() + clave.slice(1);
        nombreClave = nombreClave.replace('_', ' ');
        
        metadataItem.innerHTML = `<strong>${nombreClave}:</strong> ${valor}`;
        metadataList.appendChild(metadataItem);
    }
    
    // Mostrar sección de metadatos
    metadata.style.display = 'block';
}

/**
 * Función para exportar las preguntas en formato JSON
 */
function exportarJSON() {
    if (!ultimaRespuesta) {
        alert('No hay datos para exportar. Por favor, genera preguntas primero.');
        return;
    }
    
    // Enviar datos al backend para formatear el JSON
    fetch('/exportar', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(ultimaRespuesta)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Crear un objeto Blob con el JSON
            const blob = new Blob([data.data], { type: 'application/json' });
            
            // Crear URL para el Blob
            const url = URL.createObjectURL(blob);
            
            // Crear enlace para descargar
            descargarArchivo(url, data.filename);
        } else {
            alert(`Error al exportar: ${data.error}`);
        }
    })
    .catch(error => {
        console.error('Error al exportar JSON:', error);
        alert('Error al exportar: ' + error.message);
    });
}

/**
 * Función para exportar las preguntas en formato TXT
 */
function exportarTexto() {
    if (!ultimaRespuesta) {
        alert('No hay datos para exportar. Por favor, genera preguntas primero.');
        return;
    }
    
    let contenido = `PREGUNTAS CLAVE PARA INVESTIGACIÓN DE NICHO\n\n`;
    contenido += `Nicho: ${ultimaRespuesta.metadatos.nicho}\n`;
    contenido += `Audiencia: ${ultimaRespuesta.metadatos.audiencia}\n`;
    contenido += `Ubicación: ${ultimaRespuesta.metadatos.ubicacion}\n`;
    contenido += `Plataforma: ${ultimaRespuesta.metadatos.plataforma}\n`;
    contenido += `Fecha de generación: ${ultimaRespuesta.metadatos.fecha_generacion}\n\n`;
    contenido += `---------------------------------------------\n\n`;
    
    // Añadir cada pregunta
    ultimaRespuesta.preguntas.forEach((pregunta, index) => {
        contenido += `${index + 1}. `;
        
        if (pregunta.titulo) {
            contenido += `${pregunta.titulo}\n`;
        }
        
        contenido += `${pregunta.pregunta}\n\n`;
        
        if (pregunta.contexto) {
            contenido += `${pregunta.contexto}\n\n`;
        }
        
        contenido += `---------------------------------------------\n\n`;
    });
    
    // Crear un objeto Blob con el texto
    const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8' });
    
    // Crear URL para el Blob
    const url = URL.createObjectURL(blob);
    
    // Crear nombre de archivo
    const filename = `preguntas_nicho_${ultimaRespuesta.metadatos.nicho.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.txt`;
    
    // Descargar el archivo
    descargarArchivo(url, filename);
}

/**
 * Función para exportar las preguntas en formato PDF
 */
function exportarPDF() {
    if (!ultimaRespuesta) {
        alert('No hay datos para exportar. Por favor, genera preguntas primero.');
        return;
    }
    
    // Verificar si jsPDF está disponible
    if (typeof window.jspdf === 'undefined') {
        alert('La exportación a PDF requiere la biblioteca jsPDF que no está disponible. Por favor, intenta con otro formato.');
        return;
    }
    
    // Inicializar jsPDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Configuración de página
    let y = 20; // Posición Y inicial
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const textWidth = pageWidth - (margin * 2);
    
    // Añadir título
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('PREGUNTAS CLAVE PARA INVESTIGACIÓN DE NICHO', margin, y);
    y += 10;
    
    // Añadir metadatos
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Nicho: ${ultimaRespuesta.metadatos.nicho}`, margin, y); y += 7;
    doc.text(`Audiencia: ${ultimaRespuesta.metadatos.audiencia}`, margin, y); y += 7;
    doc.text(`Ubicación: ${ultimaRespuesta.metadatos.ubicacion}`, margin, y); y += 7;
    doc.text(`Plataforma: ${ultimaRespuesta.metadatos.plataforma}`, margin, y); y += 7;
    doc.text(`Fecha: ${ultimaRespuesta.metadatos.fecha_generacion}`, margin, y); y += 10;
    
    // Añadir línea separadora
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;
    
    // Función para añadir texto con salto de línea
    function addWrappedText(text, x, yPos, fontSize, fontType) {
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', fontType);
        
        // Dividir texto largo en múltiples líneas
        const lines = doc.splitTextToSize(text, textWidth);
        
        // Comprobar si necesitamos una nueva página
        if (yPos + (lines.length * fontSize / 2) > doc.internal.pageSize.getHeight() - margin) {
            doc.addPage();
            yPos = margin + 10;
        }
        
        // Añadir líneas de texto
        doc.text(lines, x, yPos);
        
        // Retornar nueva posición Y
        return yPos + (lines.length * fontSize / 2);
    }
    
    // Añadir cada pregunta
    ultimaRespuesta.preguntas.forEach((pregunta, index) => {
        // Añadir número de pregunta
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`${index + 1}.`, margin, y);
        y += 7;
        
        // Añadir título si existe
        if (pregunta.titulo) {
            y = addWrappedText(pregunta.titulo, margin, y, 12, 'bold');
            y += 5;
        }
        
        // Añadir pregunta
        y = addWrappedText(pregunta.pregunta, margin, y, 12, 'bold');
        y += 5;
        
        // Añadir contexto si existe
        if (pregunta.contexto) {
            y = addWrappedText(pregunta.contexto, margin, y, 10, 'normal');
            y += 10;
        }
        
        // Añadir línea separadora
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, y, pageWidth - margin, y);
        y += 10;
    });
    
    // Crear nombre de archivo
    const filename = `preguntas_nicho_${ultimaRespuesta.metadatos.nicho.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.pdf`;
    
    // Descargar el PDF
    doc.save(filename);
}

/**
 * Función auxiliar para descargar un archivo
 */
function descargarArchivo(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Liberar el objeto URL
    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 100);
}

/**
 * Event listener para habilitar el envío del formulario al presionar Enter
 */
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('nichoForm');
    const inputs = form.querySelectorAll('input');
    const initialMessage = document.getElementById('initialMessage');
    
    inputs.forEach(input => {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                generarPreguntas();
            }
        });
    });
    
    // Verificar conexión con el servidor al cargar la página
    fetch('/test')
        .then(response => {
            if (response.ok) {
                return response.json();
            } else {
                throw new Error('El servidor está respondiendo con error');
            }
        })
        .then(data => {
            console.log('Servidor en línea y listo:', data);
            if (data.model_info && data.model_info !== "No hay modelo disponible") {
                console.log('Modelo activo:', data.model_info);
            } else {
                console.warn('No hay modelo disponible, se usará el método alternativo');
            }
        })
        .catch(error => {
            console.error('No se puede conectar con el servidor:', error);
            initialMessage.textContent = 'No se puede conectar con el servidor. Verifica que el servidor esté en ejecución.';
        });
});