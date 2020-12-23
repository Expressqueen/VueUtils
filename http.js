import axios from 'axios'
import router from '@/router'
import { Message,Loading } from 'element-ui'
import store from '@/store'
import {config} from '@/utils/config'
let loadingInstance; //loading 实例
let needLoadingRequestCount = 0; //当前正在请求的数量
//请求loading状态
function showLoading() {
    let main = document.querySelector('#app')
    if (main) {
        if (needLoadingRequestCount === 0 && !loadingInstance) {
            loadingInstance = Loading.service({
                target: main, 
                fullscreen: true,
                text: '正在加载...', 
                background: 'rgba(0,0,0,0.3)', 
                lock: true
            });
        }
        needLoadingRequestCount++;
    }
}
//取消loading状态
function closeLoading() {
    Vue.nextTick(() => { // 以服务的方式调用的 Loading 需要异步关闭
        needLoadingRequestCount--;
        needLoadingRequestCount = Math.max(needLoadingRequestCount, 0); // 保证大于等于0
        if (needLoadingRequestCount === 0) {
            if (loadingInstance) {
                loadingInstance.close();
                loadingInstance = null;
            }
        }
    });
}
//提示函数
const tip = msg => {
    Message({
        message: msg || 'Error',
        type: 'error',
        duration: 5 * 1000
    })
}
//跳转登录页，携带当前页面路由，登录后返回到当前页面
const toLogin = () => {
    router.replace({
        path: "/login",
        query: {
            redirect: router.currentRoute.fullPath
        }
    })
}
//错误处理
const errHandle = (status, other) => {
    switch (status) {
        //未登录401
        case 401:
            toLogin();
            break;
        case 403:
            tip("登录过期，请重新登录")
            // 清除token
            removeToken();
            store.commit('loginSuccess', null);
            setTimeout(() => {
                toLogin();
            }, 1000);
            break;
        case 404:
            tip("请求资源不存在")
            break;
        default:
            console.log(other)

    }
}

//用于存储目前状态为pending的请求标识信息
let pendingRequest = [];

//取消请求-请求拦截中的处理
const CancelToken = config => {
    //区分请求的唯一标识，这里用方法名+请求路径
    const requestMark = `${config.method} ${config.url}`;
    //找寻当前的请求标识是否存在pendingRequest中（判断是否重复请求）
    const markIndex = pendingRequest.findIndex(item => {
        return item.name === requestMark
    });
    //存在（重复请求）
    if (markIndex > -1) {
        //取消上个重复的请求
        pendingRequest[markIndex].cancel();
        //删掉在pendingRequest中的请求标识
        pendingRequest.splice(markIndex, 1);
    };
    //新建针对这次请求的axios的cancelToken标识
    const CancelToken = axios.CancelToken;
    const source = CancelToken.source();
    config.cancelToken = source.token;
    //设置自定义配置的requestMark项,主要用于响应拦截中
    config.requestMark = requestMark;
    //记录本次请求的标识
    pendingRequest.push({
        name: requestMark,
        cancel=source.cancel
    });
    return config;
};

//取消请求-响应拦截中的处理
const CancelTokenResponse = config => {
    //根据请求拦截里设置的requestMark配置来寻找对应pendingRequest里对应的请求标识
    const markIndex = pendingRequest.findIndex(item => {
        return item.name === config.requestMark
    });
    //找到了删除标识
    markIndex > -1 && pendingRequest.splice(markIndex, 1);
}
//创建axios实例
var http = axios.create({
    baseURL:config.apiUrl,
    timeout: 1000 * 5
})

//post请求头的设置
http.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
//请求拦截器
http.interceptors.request.use(
    config => {
        showLoading()
        config = CancelToken(config);
        const token = store.getters.token;
        token && (config.headers.Authorization = token);
        return config
    },
    error => {
        closeLoading()
        Promise.reject(error)
    }
)
//响应拦截器
http.interceptors.response.use(
    res => {
        closeLoading();
        CancelTokenResponse(res.config);
        return res.status === 200 ? Promise.resolve(res) : Promise.reject(res)
    },
    error => {
        closeLoading();
        const { response } = error;
        //请求已经发出，返回结果不在2XX的范围
        if (response) {
            if (response.status) {
                CancelTokenResponse(response.config);
                errHandle(response.status, response.data.message)
                return Promise.reject(response)
            } else if (error && error.stack.indexOf('timeout') > -1) {
                tip("请求超时")
            }
        } else {
            //断网情况刷新重新获取数据
            if (!window.navigator.onLine) {
                store.commit('ChangeNetwork', false);
            } else {
                return Promise.reject(error)
            }
        }
    }
)
//全局封装请求方式
const _requset=(url,data,method,config={})=>{
    return new Promise((resolve,reject)=>{
        const setobj=method !== 'get'?{method,url,data,...config}:{method,url,params:data,...config}
        http(setobj).then(response=>{
            resolve(response)
        }).catch(error=>{
            reject(error)
        })
    })
}
export default _requset

//api使用例子
// export const login = (params) => _requset('/vue-element-admin/user/login', params, 'post')