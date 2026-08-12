export interface MinewLoginRequest {
  username: string;
  password: string;
}

export interface MinewStore {
  storeId: string;
  storeName: string;
  address?: string;
  active: number;
}

export interface ProductResponse {
  code: number;
  msg: string;
  currentPage: number;
  pageSize: number;
  totalNum: number;
  isMore: boolean | null;
  totalPage: number | null;
  startIndex: number | null;
  items: ProductItem[];
  hasStore: boolean;
}

export interface ProductItem {
  id: string;
  storeId: string;
  specification?: string;
  discount?: string;
  barcoode?: string;
  qrcode?: string;
  image?: string;

  memberPrice?: string;
  origin?: string;
  price?: string;
  unit?: string;
}