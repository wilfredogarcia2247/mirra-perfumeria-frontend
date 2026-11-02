import { Navigate, useParams } from 'react-router-dom';
import { idDesdeSlug } from '@/lib/compartir';

// /p/ch-good-girl-33 -> tienda con ese perfume abierto.
// (Cuando el dominio envíe /p/ al servidor, este paso lo hará el servidor junto con la vista previa.)
export default function AbrirPerfume() {
  const { slug } = useParams();
  const id = idDesdeSlug(slug);
  return <Navigate to={id ? `/?producto=${id}` : '/'} replace />;
}
