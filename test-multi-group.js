const axios = require('axios');

async function testMultiGroup() {
  try {
    console.log('🧪 Probando multi-grupo MANTENIMIENTO;TRANSPORTE...\n');
    
    // Simular llamada con token que incluye múltiples grupos
    const response = await axios.get('http://localhost:3000/api/tipos-tarea', {
      params: { grupos: 'MANTENIMIENTO;TRANSPORTE' }
    });
    
    console.log('✅ Respuesta exitosa:');
    console.log('Tipos de tarea encontrados:', response.data.length);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testMultiGroup();