export type BackendAccount = {
  userId: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  isAdmin: boolean;
};

export type BackendCredentialsVerifyResponse = {
  account: BackendAccount;
};

export type BackendRegisterResponse = {
  account: {
    email: string;
  };
};