import { useNavigate } from 'react-router-dom';

type BackToDashboardButtonProps = {
  className?: string;
};

const baseClass = 'inline-flex items-center justify-center rounded-full border border-border/70 bg-transparent px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-text transition hover:text-text hover:border-accent focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-transparent';

export function BackToDashboardButton({ className }: BackToDashboardButtonProps) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      className={`${baseClass} ${className ?? ''}`.trim()}
      onClick={() => navigate('/')}
    >
      Back to Dashboard
    </button>
  );
}

export default BackToDashboardButton;
