export interface Bindings {
  APP_ENV: 'development' | 'staging' | 'production';
}

export interface AppEnv {
  Bindings: Bindings;
}
