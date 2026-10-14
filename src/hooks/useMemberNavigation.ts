import { useLocation, useNavigate } from 'react-router-dom';

export default function useMemberNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  return (id: string, context: { fromFamilyId?: string } = {}) => navigate(`/members/${encodeURIComponent(id)}`, {
    state: { ...context, returnTo: location.pathname + location.search + location.hash },
  });
}
