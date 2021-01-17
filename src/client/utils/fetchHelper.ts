import FetchHelper from 'slate-env-web/utils/fetchHelper';

const fetch: any = window.fetch?.bind(window) ?? (() => Promise.reject('No web access'));

export const fetchHelper = new FetchHelper(fetch);
