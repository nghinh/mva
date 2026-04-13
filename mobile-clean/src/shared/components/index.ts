/**
 * Shared UI Components
 *
 * Base components built on theme tokens
 */

/**
 * Button component
 */
export function Button(_props: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
}) {
  return null; // Scaffold
}

/**
 * Card component
 */
export function Card(_props: {children: React.ReactNode}) {
  return null; // Scaffold
}

/**
 * Text component with typography tokens
 */
export function Typography(_props: {
  variant?: keyof typeof import('../theme/typography').typography;
  children: React.ReactNode;
}) {
  return null; // Scaffold
}
