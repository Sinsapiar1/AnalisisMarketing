import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import google.generativeai as genai
import json
from datetime import datetime


# Inicializar aplicación Flask
app = Flask(__name__)
CORS(app)  # Habilitar CORS para todas las rutas

# Ruta para servir los archivos estáticos/frontend
@app.route('/')
def serve_frontend():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder, path)

# Lista de posibles nombres de modelos para probar
POSSIBLE_MODELS = [
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'gemini-pro', 
    'gemini-1.0-pro', 
    'text-bison',
    'chat-bison'
]

# Variable global para almacenar el modelo que funcione
working_model = None

# Configurar la API de Gemini con la clave de API
try:
    # Usar la clave API directamente
    GOOGLE_API_KEY = "AIzaSyD3LUr6ntBBvi54YpPeMjjnAz9pr94u0IM"
    genai.configure(api_key=GOOGLE_API_KEY)
    print("API de Gemini configurada con la clave proporcionada")
    
    # Listar los modelos disponibles para debug
    print("Intentando listar los modelos disponibles...")
    available_models = []
    
    try:
        models = genai.list_models()
        for m in models:
            model_name = m.name
            if '/' in model_name:
                # Extraer solo el nombre del modelo sin la ruta completa
                model_name = model_name.split('/')[-1]
            available_models.append(model_name)
            print(f"Modelo disponible: {model_name}")
        
        print(f"Total de modelos disponibles: {len(available_models)}")
    except Exception as model_error:
        print(f"Error al listar modelos: {str(model_error)}")
        
    # Intentar encontrar un modelo que funcione
    print("Intentando encontrar un modelo que funcione...")
    
    for model_name in POSSIBLE_MODELS:
        try:
            print(f"Probando con el modelo: {model_name}")
            test_model = genai.GenerativeModel(model_name)
            
            # Intentar una generación simple para verificar que funciona
            test_response = test_model.generate_content("Hola")
            print(f"¡El modelo {model_name} funciona correctamente!")
            working_model = test_model
            break
        except Exception as model_error:
            print(f"Error con el modelo {model_name}: {str(model_error)}")
    
    if working_model is None:
        print("ADVERTENCIA: No se pudo encontrar ningún modelo que funcione")
    else:
        print(f"Se usará el modelo: {working_model}")
            
except Exception as e:
    print(f"Error al configurar la API de Gemini: {str(e)}")

@app.route('/generar_preguntas_gemini', methods=['POST'])
def generar_preguntas():
    try:
        # Verificar si tenemos un modelo funcional
        if working_model is None:
            return jsonify({
                'error': 'No se pudo inicializar ningún modelo de Gemini. Por favor, verifica la clave API y los modelos disponibles.'
            }), 500
            
        # Obtener datos de la solicitud
        data = request.json
        print(f"Datos recibidos: {data}")
        
        # Validar campos requeridos
        if not data.get('nicho') or not data.get('audiencia'):
            return jsonify({
                'error': 'Los campos "nicho" y "audiencia" son obligatorios'
            }), 400
        
        # Extraer valores de la solicitud
        nicho = data.get('nicho')
        audiencia = data.get('audiencia')
        ubicacion = data.get('ubicacion', 'No especificada')
        plataforma = data.get('plataforma', 'No especificada')
        
        # Crear prompt mejorado para Gemini
        prompt = f"""
        Eres un consultor experto en marketing de afiliados con amplia experiencia en investigación de mercados y análisis de nichos. Tu tarea es proporcionar insights estratégicos para un marketeer que desea explorar oportunidades en el siguiente contexto:
        
        CONTEXTO DEL NICHO:
        - Nicho principal: {nicho}
        - Audiencia objetivo: {audiencia}
        - Ubicación geográfica: {ubicacion}
        - Plataforma de promoción: {plataforma}
        
        Por favor, genera 5 preguntas estratégicas con contexto detallado que un marketeer de afiliados debería investigar a fondo para identificar productos ganadores y oportunidades de mercado.
        
        Para cada pregunta:
        1. Formula una pregunta específica y detallada adaptada al nicho, audiencia y ubicación.
        2. Explica por qué esta pregunta es importante estratégicamente.
        3. Incluye ejemplos concretos o subtemas relacionados dentro de la respuesta.
        
        Las preguntas deben abarcar las siguientes áreas estratégicas (una pregunta por área):
        
        A) TENDENCIAS Y COMPORTAMIENTOS ACTUALES
        Analiza tendencias emergentes, comportamientos de consumo o cambios recientes en este nicho específico.
        
        B) PROBLEMAS Y NECESIDADES DE LA AUDIENCIA
        Identifica dolores, frustraciones, aspiraciones o necesidades específicas que enfrenta esta audiencia en relación con este nicho.
        
        C) SUBNICHOS Y SEGMENTOS RENTABLES
        Explora subnichos o micro-nichos con alto potencial pero menor competencia.
        
        D) PRODUCTOS Y CARACTERÍSTICAS EXITOSAS
        Analiza qué tipo de productos, servicios o soluciones están teniendo éxito en este mercado y por qué.
        
        E) DIFERENCIACIÓN Y POSICIONAMIENTO
        Explora ángulos únicos de posicionamiento que permitan destacar en un mercado competitivo.
        
        Formatea cada pregunta como un punto separado, comenzando con un título en negrita que identifique el área, seguido de la pregunta completa y su contexto. No incluyas numeración al principio de cada punto.
        
        Asegúrate de que el contenido sea extremadamente específico al nicho, audiencia y ubicación proporcionados, evitando generalidades.
        """
        
        print(f"Enviando prompt al modelo...")
        
        # Generar respuesta desde el modelo con manejo de errores
        try:
            response = working_model.generate_content(prompt)
            print("Respuesta recibida del modelo")
            
            if hasattr(response, 'text') and response.text:
                questions_text = response.text.strip()
                print(f"Texto recibido: {questions_text[:100]}...")
                
                # Procesar el texto para extraer las preguntas
                sections = []
                current_section = {"titulo": "", "pregunta": "", "contexto": ""}
                
                # Intentar parsear el texto en secciones
                lines = questions_text.split('\n')
                for i, line in enumerate(lines):
                    line = line.strip()
                    
                    # Saltarse líneas vacías
                    if not line:
                        continue
                    
                    # Detectar un posible título (en negrita o con un formato distintivo)
                    if line.startswith('**') and line.endswith('**'):
                        # Si ya tenemos una sección en progreso, guardarla
                        if current_section["titulo"] or current_section["pregunta"]:
                            sections.append(current_section)
                            current_section = {"titulo": "", "pregunta": "", "contexto": ""}
                        
                        # Extraer el título sin los asteriscos
                        current_section["titulo"] = line.strip('*').strip()
                    
                    # Si la línea parece una pregunta (termina con ?)
                    elif '?' in line:
                        # Dividir en pregunta y posible contexto inicial
                        question_parts = line.split('?', 1)
                        current_section["pregunta"] = question_parts[0].strip() + '?'
                        
                        # Si hay texto después del signo de interrogación, añadirlo al contexto
                        if len(question_parts) > 1 and question_parts[1].strip():
                            current_section["contexto"] += question_parts[1].strip() + ' '
                    
                    # Si no es título ni pregunta, es parte del contexto
                    else:
                        current_section["contexto"] += line + ' '
                
                # Añadir la última sección si existe
                if current_section["titulo"] or current_section["pregunta"]:
                    sections.append(current_section)
                
                # Si no pudimos parsear correctamente, usar un enfoque más simple
                if not sections:
                    print("No se pudieron identificar secciones estructuradas, usando enfoque alternativo")
                    # Dividir por párrafos y tratar cada uno como una pregunta
                    paragraphs = []
                    current_paragraph = ""
                    
                    for line in lines:
                        if line.strip():
                            current_paragraph += line + " "
                        elif current_paragraph:
                            paragraphs.append(current_paragraph.strip())
                            current_paragraph = ""
                    
                    if current_paragraph:
                        paragraphs.append(current_paragraph.strip())
                    
                    sections = [{"titulo": "", "pregunta": p, "contexto": ""} for p in paragraphs]
                
                # Verificar que tenemos preguntas
                if not sections:
                    print("No se encontraron preguntas en la respuesta")
                    return jsonify({
                        'error': 'No se pudieron extraer preguntas de la respuesta generada'
                    }), 500
                
                print(f"Preguntas generadas: {len(sections)}")
                
                # Crear la respuesta con fecha de generación
                current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                response_data = {
                    'preguntas': sections,
                    'metadatos': {
                        'nicho': nicho,
                        'audiencia': audiencia,
                        'ubicacion': ubicacion,
                        'plataforma': plataforma,
                        'fecha_generacion': current_time
                    }
                }
                
                return jsonify(response_data)
            else:
                print("Respuesta sin texto válido")
                return jsonify({
                    'error': 'La respuesta del modelo no contiene texto válido'
                }), 500
                
        except Exception as gemini_error:
            error_message = str(gemini_error)
            print(f"Error al generar contenido: {error_message}")
            return jsonify({
                'error': f'Error al generar contenido: {error_message}'
            }), 500
    
    except Exception as e:
        error_message = str(e)
        print(f"Error general: {error_message}")
        return jsonify({
            'error': f'Error al procesar la solicitud: {error_message}'
        }), 500

# Ruta para exportar las preguntas en formato JSON
@app.route('/exportar', methods=['POST'])
def exportar_preguntas():
    try:
        data = request.json
        if not data or not data.get('preguntas'):
            return jsonify({
                'error': 'No hay datos para exportar'
            }), 400
            
        # Convertir los datos a JSON formateado
        formatted_json = json.dumps(data, indent=2, ensure_ascii=False)
        
        return jsonify({
            'success': True,
            'data': formatted_json,
            'filename': f"preguntas_nicho_{data.get('metadatos', {}).get('nicho', 'general')}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        })
    except Exception as e:
        return jsonify({
            'error': f'Error al exportar datos: {str(e)}'
        }), 500

# Ruta de prueba simple para verificar que el servidor está funcionando
@app.route('/test', methods=['GET'])
def test_server():
    return jsonify({
        'status': 'ok',
        'message': 'El servidor está funcionando correctamente',
        'model_info': str(working_model) if working_model else "No hay modelo disponible"
    })

# Ruta alternativa para usar una implementación básica si Gemini falla
@app.route('/generar_preguntas_basicas', methods=['POST'])
def generar_preguntas_basicas():
    try:
        # Obtener datos de la solicitud
        data = request.json
        
        # Validar campos requeridos
        if not data.get('nicho') or not data.get('audiencia'):
            return jsonify({
                'error': 'Los campos "nicho" y "audiencia" son obligatorios'
            }), 400
        
        # Extraer valores de la solicitud
        nicho = data.get('nicho')
        audiencia = data.get('audiencia')
        ubicacion = data.get('ubicacion', 'No especificada')
        plataforma = data.get('plataforma', 'No especificada')
        
        # Generar preguntas básicas basadas en el nicho y la audiencia
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        preguntas = [
            {
                "titulo": "TENDENCIAS Y COMPORTAMIENTOS",
                "pregunta": f"¿Cuáles son las tendencias actuales en el nicho de {nicho} para {audiencia} en {ubicacion}?",
                "contexto": f"Identificar tendencias emergentes puede revelar oportunidades de mercado poco saturadas. Considera aspectos como cambios estacionales, eventos locales o tendencias de búsqueda recientes."
            },
            {
                "titulo": "PROBLEMAS Y NECESIDADES",
                "pregunta": f"¿Qué problemas o necesidades específicas tiene {audiencia} en relación con {nicho} en {ubicacion}?",
                "contexto": f"Entender los dolores de tu audiencia te permitirá posicionar productos como soluciones efectivas. Considera factores como clima, cultura local o estilos de vida específicos de la región."
            },
            {
                "titulo": "SUBNICHOS RENTABLES",
                "pregunta": f"¿Cuáles son los subnichos más rentables dentro de {nicho} para {audiencia} en {ubicacion}?",
                "contexto": f"Los micronichos suelen tener menor competencia y mayor conversión. Busca segmentos específicos donde puedas convertirte en una autoridad rápidamente."
            },
            {
                "titulo": "PRODUCTOS EXITOSOS",
                "pregunta": f"¿Qué tipos de productos relacionados con {nicho} están teniendo mayor éxito en {plataforma} para {audiencia}?",
                "contexto": f"Analiza características comunes de productos exitosos como precio, formato, beneficios principales o estrategias de presentación en {plataforma}."
            },
            {
                "titulo": "DIFERENCIACIÓN",
                "pregunta": f"¿Cómo puedo diferenciar mi oferta de {nicho} de la competencia para atraer a {audiencia} en {ubicacion} a través de {plataforma}?",
                "contexto": f"La diferenciación efectiva puede basarse en origen local, personalización, servicio premium o enfoque en nichos desatendidos. Considera qué valores son importantes para tu audiencia específica."
            }
        ]
        
        response_data = {
            'preguntas': preguntas,
            'metadatos': {
                'nicho': nicho,
                'audiencia': audiencia,
                'ubicacion': ubicacion,
                'plataforma': plataforma,
                'fecha_generacion': current_time
            }
        }
        
        return jsonify(response_data)
        
    except Exception as e:
        return jsonify({
            'error': f'Error al procesar la solicitud: {str(e)}'
        }), 500

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)