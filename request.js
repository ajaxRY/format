// request请求方法
import axios from 'axios';

/* 全局设置 */

// 开发模式与线上模式 切换不通API
const host = (process.env.APP_ENV == 'release') ? 'https://api.quanminbtc.com/api/v1/' : 'http://miner.quzuan8.com/api/v1/';

// API实例
let service = axios.create({
    baseURL: host
});

/* 自动renew相关代码 */

// renew Token 的 URL , TODO 按实际情况修改
const TOKEN_RENEW_URL = 'token/refresh';

// 是否正在刷新的标志
let isRefreshing = false;
// 存储pendding请求的数组
let refreshSubscribers = [];

/**
 * 将所有的pendding请求都push到数组中
 * @param {*} cb 
 */
const subscribeTokenRefresh = (cb) => {
    refreshSubscribers.push(cb);
};

/**
 * 数组中的请求得到新的token之后自执行，用新的token去请求数据
 * @param {*} token 
 */
const onRrefreshed = (token) => {
    refreshSubscribers.map(cb => cb(token));
};

/* 读取Token相关信息 */
const loadTimeStamp = () => localStorage.getItem('tokenExpTime');
const loadUserToken = () => localStorage.getItem('token');

const saveToken = (token, refreshToken) => {
    try {
        localStorage.setItem('refreshToken', refreshToken);
        localStorage.setItem('token', token);
        localStorage.setItem('tokenExpTime', Date.now());
    } catch (err) {
        // nothing todo ?
    }
};

const clearToken = () => {
    try {
        localStorage.setItem('refreshToken', '');
        localStorage.setItem('token', '');
        localStorage.setItem('tokenExpTime', 0);
    } catch (err) {
        // nothing todo ?
    }
};

/**
 *  判断token的刷新时间 (30分钟一次)
 */
const isNeedRefreshToken = () => {
    const oData = loadTimeStamp();
    const nDta = Date.now();
    const stamp = nDta - oData;
    const minutes = parseInt((stamp % (1000 * 60 * 60)) / (1000 * 60));
    return (minutes >= 30);
};

/**
 * 刷新token,按实际API修改 TODO
 */
const doRefreshToken = () => {
    return service.post(TOKEN_RENEW_URL)
        .then((res) => {
            return Promise.resolve(res.data);
        });
};


/**
 * 请求拦截器, 添加 Authorization, 定期 renew Token
 */
service.interceptors.request.use(
    config => {
        const accessToken = loadUserToken(); // 本地保存的token
        // 判断token是否存在
        if (accessToken) {
            // 在请求头中添加token
            if (accessToken !== 'dummy') {
                config.headers.Authorization = `Bearer ${accessToken}`;
            }
            // 判断token是否将要过期, 是否要刷新, 跳过 renew 的 URL
            const isRefresURL = (config.url.indexOf(TOKEN_RENEW_URL) !== -1);
            if (!isRefreshing) {
                if (isRefresURL) {
                    delete config.headers.Authorization;
                    const token = localStorage.getItem('refreshToken');
                    config.data = {token};
                    isRefreshing = true;
                    return config;
                }

                if (isNeedRefreshToken()) {
                    // 发起刷新token的请求
                    doRefreshToken().then(() => {
                        //
                    }).catch(err => {
                        Promise.reject(err);
                    });
                }
            }
            if (isRefreshing) {
                // 把请求(token)=>{....}都push到一个数组中
                let retry = new Promise((resolve) => {
                    subscribeTokenRefresh((token) => {
                        // 这里是新Token
                        if (!isRefresURL) {
                            config.headers.Authorization = `Bearer ${token}`;
                        }
                        resolve(config);
                    });
                });
                return retry;
            }
        }
        return config;
    },
    err => {
        return Promise.reject(err);
    }
);

// 全局设置的彻底过期需要登录的回调, 通常就是跳转到登录页
let needAuthCallback = null;

// TODO 过期后要不要自动renew, 还会只在请求时renew?
/**
 * 回应拦截, 处理未登录回调
 */
service.interceptors.response.use(response => {
    const isRefresURL = (response.config.url.indexOf(TOKEN_RENEW_URL) !== -1);
    if (isRefresURL) {
        saveToken(response.data.access_token, response.data.token, Date.now());
        isRefreshing = false;

        // 重新发起被挂起的请求
        onRrefreshed(response.data.access_token);
        // 清空数组中保存的请求
        refreshSubscribers = [];        
    }
    return response;
},
error => {
    const isRefresURL = (error.config.url.indexOf(TOKEN_RENEW_URL) !== -1);
    if (isRefresURL) {
        isRefreshing = false;
    }
    let errorResponse = error.response;
    if (errorResponse && errorResponse.status === 401) {
        clearToken(); // 清空所有缓存
        needAuthCallback && needAuthCallback();
    }
    return Promise.reject(errorResponse || {data:{msg:'未知错误', code:-1}});
});

/**
 * 导出的工具函数集合, 返回的是真实data, 不是axio的response, 尽量避免和axios打交到
 */
export default {
    /**
     * 登录成功 设置 token
     * @param {*} token 
     * @param {*} refreshToken 
     */
    saveToken(token, refreshToken) {
        saveToken(token, refreshToken);
    },

    /**
     * 
     */
    clearToken() {
        clearToken();
    },

    /**
     * 设置 需要授权的 callback 
     * @param {*} callback 
     */
    setAuthNeedCallback(callback) {
        needAuthCallback = callback;
    },

    /**
     * axios的get请求
     * @param {*} url
     * @param {*} params 
     */
    get(url, params = {}) {
        return new Promise((resolve, reject) => {
            service.get(url, { params })
                .then(response => {
                    resolve(response.data);
                }).catch(error => {
                    reject(error.data);
                });
        });
    },

    /**
     * axios的post请求
     * @param {*} url 
     * @param {*} data 
     */
    post(url, data = {}) {
        return new Promise((resolve, reject) => {
            service.post(url, data)
                .then(response => {
                    resolve(response.data);
                }).catch(error => {
                    reject(error.data);
                });
        });
    },

    /**
     * axios的put请求
     * @param {*} url 
     * @param {*} data 
     */
    put(url, data = {}) {
        return new Promise((resolve, reject) => {
            service.put(url, data)
                .then(response => {
                    resolve(response.data);
                }).catch(error => {
                    reject(error.data);
                });
        });
    },

    /**
     * axios的delete请求
     * @param {*} url 
     * @param {*} data 
     */
    delete(url, data = {}) {
        return new Promise((resolve, reject) => {
            service.delete(url, { data })
                .then(response => {
                    resolve(response.data);
                }).catch(error => {
                    reject(error.data);
                });
        });
    },

    /**
     * axios的并发请求
     * @param {*} queryAll 
     */
    all(queryAll) {
        return Promise.all(queryAll);
    }
};
