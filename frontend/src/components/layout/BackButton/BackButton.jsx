import { useNavigate } from 'react-router-dom';

export default function BackButton({ revealed = true, delay = 0 }) {
  const navigate = useNavigate();

  return (
    <button
      className="back-btn"
      style={{
        opacity: revealed ? 1 : 0,
        transform: revealed ? 'translateX(0)' : 'translateX(-16px)',
        transitionDelay: `${delay}ms`,
        animationDelay: `${delay}ms`
      }}
      onClick={() => navigate('/dashboard')}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
      Back to Dashboard
    </button>
  );
}
