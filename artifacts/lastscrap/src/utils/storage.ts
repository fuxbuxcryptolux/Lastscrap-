import AsyncStorage from "@react-native-async-storage/async-storage";

export const storage = {
  async getItem<T = string>(key: string, defaultValue: T): Promise<string | T> {
    try {
      const val = await AsyncStorage.getItem(key);
      return val !== null ? val : defaultValue;
    } catch {
      return defaultValue;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch {}
  },
};
