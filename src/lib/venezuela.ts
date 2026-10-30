// Estados de Venezuela (23 estados + Distrito Capital) con sus ciudades principales.
// Se usa en "Finalizar compra" (envío nacional) para saber desde dónde nos compran.
// Si la ciudad del cliente no está en la lista, puede elegir "Otra ciudad" y escribirla.

export const OTRA_CIUDAD = '__otra__';

export const ESTADOS_VENEZUELA: { estado: string; ciudades: string[] }[] = [
  { estado: 'Amazonas', ciudades: ['Puerto Ayacucho', 'San Fernando de Atabapo', 'Maroa', 'La Esmeralda'] },
  { estado: 'Anzoátegui', ciudades: ['Barcelona', 'Puerto La Cruz', 'Lechería', 'El Tigre', 'Anaco', 'Guanta', 'Cantaura', 'San José de Guanipa', 'Puerto Píritu', 'Clarines', 'Pariaguán'] },
  { estado: 'Apure', ciudades: ['San Fernando de Apure', 'Guasdualito', 'Achaguas', 'Biruaca', 'Elorza', 'Mantecal'] },
  { estado: 'Aragua', ciudades: ['Maracay', 'Turmero', 'La Victoria', 'Cagua', 'Villa de Cura', 'Palo Negro', 'Santa Rita', 'El Limón', 'San Mateo', 'Las Tejerías', 'Santa Cruz de Aragua'] },
  { estado: 'Barinas', ciudades: ['Barinas', 'Socopó', 'Santa Bárbara de Barinas', 'Barinitas', 'Sabaneta', 'Ciudad Bolivia'] },
  { estado: 'Bolívar', ciudades: ['Puerto Ordaz', 'San Félix', 'Ciudad Bolívar', 'Upata', 'Guasipati', 'El Callao', 'Tumeremo', 'Caicara del Orinoco', 'Santa Elena de Uairén'] },
  { estado: 'Carabobo', ciudades: ['Valencia', 'Puerto Cabello', 'Guacara', 'San Diego', 'Naguanagua', 'Los Guayos', 'Tocuyito', 'Mariara', 'Güigüe', 'Bejuma', 'Morón'] },
  { estado: 'Cojedes', ciudades: ['San Carlos', 'Tinaquillo', 'Tinaco', 'El Pao', 'Las Vegas'] },
  { estado: 'Delta Amacuro', ciudades: ['Tucupita', 'Pedernales', 'Curiapo'] },
  { estado: 'Distrito Capital', ciudades: ['Caracas'] },
  { estado: 'Falcón', ciudades: ['Coro', 'Punto Fijo', 'Tucacas', 'Chichiriviche', 'Dabajuro', 'Churuguara', 'La Vela de Coro', 'Puerto Cumarebo'] },
  { estado: 'Guárico', ciudades: ['San Juan de los Morros', 'Calabozo', 'Valle de la Pascua', 'Zaraza', 'Altagracia de Orituco', 'Tucupido', 'El Sombrero', 'Las Mercedes'] },
  { estado: 'La Guaira', ciudades: ['La Guaira', 'Catia La Mar', 'Maiquetía', 'Macuto', 'Caraballeda', 'Naiguatá'] },
  { estado: 'Lara', ciudades: ['Barquisimeto', 'Cabudare', 'Carora', 'El Tocuyo', 'Quíbor', 'Duaca', 'Sanare', 'Siquisique'] },
  { estado: 'Mérida', ciudades: ['Mérida', 'El Vigía', 'Ejido', 'Tovar', 'Lagunillas', 'Mucuchíes', 'Santa Cruz de Mora', 'Bailadores', 'Timotes'] },
  { estado: 'Miranda', ciudades: ['Los Teques', 'Guarenas', 'Guatire', 'Petare', 'Baruta', 'Chacao', 'El Hatillo', 'San Antonio de los Altos', 'Carrizal', 'Charallave', 'Cúa', 'Ocumare del Tuy', 'Santa Teresa del Tuy', 'Higuerote', 'Río Chico'] },
  { estado: 'Monagas', ciudades: ['Maturín', 'Punta de Mata', 'Temblador', 'Caripito', 'Caripe', 'Aragua de Maturín', 'Barrancas del Orinoco'] },
  { estado: 'Nueva Esparta', ciudades: ['Porlamar', 'Pampatar', 'La Asunción', 'Juan Griego', 'El Valle del Espíritu Santo', 'Punta de Piedras'] },
  { estado: 'Portuguesa', ciudades: ['Guanare', 'Acarigua', 'Araure', 'Turén', 'Guanarito', 'Ospino', 'Biscucuy', 'Villa Bruzual'] },
  { estado: 'Sucre', ciudades: ['Cumaná', 'Carúpano', 'Güiria', 'Cumanacoa', 'Araya', 'Río Caribe', 'Irapa', 'Casanay'] },
  { estado: 'Táchira', ciudades: ['San Cristóbal', 'Táriba', 'San Antonio del Táchira', 'Ureña', 'Rubio', 'La Fría', 'Palmira', 'Capacho', 'Colón', 'La Grita', 'Santa Ana'] },
  { estado: 'Trujillo', ciudades: ['Valera', 'Trujillo', 'Boconó', 'Carvajal', 'Sabana de Mendoza', 'Pampán', 'Monay', 'Escuque'] },
  { estado: 'Yaracuy', ciudades: ['San Felipe', 'Yaritagua', 'Chivacoa', 'Nirgua', 'Cocorote', 'Independencia', 'Aroa', 'Urachiche'] },
  { estado: 'Zulia', ciudades: ['Maracaibo', 'San Francisco', 'Cabimas', 'Ciudad Ojeda', 'Santa Bárbara del Zulia', 'Machiques', 'La Concepción', 'Villa del Rosario', 'Bachaquero', 'Santa Rita', 'Los Puertos de Altagracia', 'Mene Grande', 'La Cañada de Urdaneta', 'San Carlos del Zulia'] },
];

export function ciudadesDe(estado: string): string[] {
  return ESTADOS_VENEZUELA.find((e) => e.estado === estado)?.ciudades ?? [];
}
