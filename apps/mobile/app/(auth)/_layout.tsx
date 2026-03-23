import { Stack, Redirect } from 'expo-router';
import { useAuthContext } from '@/context/AuthContext';
import { ActivityIndicator, View } from 'react-native';

export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuthContext();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)/groups" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
