import { LoginScreen } from '@/src/features/auth/LoginScreen';

// Файл-роут максимально тонкий - сам экран (форма, состояние, запросы)
// живёт в src/features/auth/LoginScreen.tsx. См. пояснение в
// корневом README.md, раздел "Почему так" - app/ только про навигацию.
export default function Login() {
  return <LoginScreen />;
}
