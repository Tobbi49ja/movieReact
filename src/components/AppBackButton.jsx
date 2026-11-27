import { useLocation, useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';

export default function AppBackButton() {
  const isAppUI = typeof document !== 'undefined' && document.documentElement.dataset.app === 'true';
  const { pathname } = useLocation();
  const navigate = useNavigate();

  if (!isAppUI || pathname === '/') return null;

  const isWatch = /^\/(watch|tv)\/[^/]+/.test(pathname);

  const onBack = () => {
    if (window.history.state && window.history.state.idx > 0) navigate(-1);
    else navigate('/', { replace: true });
  };

  return (
    <button
      type="button"
      aria-label="Go back"
      onClick={onBack}
      className={`app-back${isWatch ? ' app-back--bar' : ''}`}
    >
      <FiArrowLeft />
    </button>
  );
}
