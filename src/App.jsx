// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import { PublicClientApplication } from '@azure/msal-browser';
import { Client } from '@microsoft/microsoft-graph-client';
import { Readability } from '@mozilla/readability';

// 创建DOMParser实例，用于解析HTML内容
const parser = new DOMParser();

// MSAL 配置
const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_CLIENT_ID, // 从环境变量读取客户端ID
    authority: 'https://login.microsoftonline.com/common', // 使用common租户（支持微软个人账户和工作账户）
    redirectUri: window.location.origin, // 动态使用当前页面的URL作为重定向URI
  },
  cache: {
    cacheLocation: 'sessionStorage', // 使用sessionStorage提高安全性
    storeAuthStateInCookie: false // 不存储认证状态在cookie中
  },
  system: {
    asyncPopups: true, // 启用异步弹窗，避免COOP警告
  }
};

// 创建 MSAL 实例
const pca = new PublicClientApplication(msalConfig);

function App() {
  const [url, setUrl] = useState('');
  const [article, setArticle] = useState(null);
  const [editableContent, setEditableContent] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState('');
  const [isMsalInitialized, setIsMsalInitialized] = useState(false);
  const [notebooks, setNotebooks] = useState([]);
  const [selectedNotebook, setSelectedNotebook] = useState('');
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState('');
  const [isLoadingNotebooks, setIsLoadingNotebooks] = useState(false);
  const [isLoadingSections, setIsLoadingSections] = useState(false);

  // 获取访问令牌
  const getAccessToken = async () => {
    // 获取所有账户
    const accounts = pca.getAllAccounts();
    if (accounts.length === 0) {
      throw new Error('用户未登录，请先登录');
    }
    
    // 获取活跃账户
    const account = pca.getActiveAccount() || accounts[0];
    pca.setActiveAccount(account);
    
    // 获取访问令牌
    let accessTokenResult;
    try {
      // 首先尝试静默获取令牌
      accessTokenResult = await pca.acquireTokenSilent({
        account,
        scopes: ['User.Read', 'Notes.ReadWrite.All', 'Notes.Create']
      });
    } catch (silentError) {
      // 静默获取失败，尝试交互式获取
      accessTokenResult = await pca.acquireTokenPopup({
        account,
        scopes: ['User.Read', 'Notes.ReadWrite.All', 'Notes.Create']
      });
    }
    
    // 确保获取到了有效的令牌
    if (!accessTokenResult || !accessTokenResult.accessToken) {
      throw new Error('无法获取有效的访问令牌');
    }
    
    return accessTokenResult.accessToken;
  };

  // 获取分区列表
  const fetchSections = async (notebookId, accessToken = null) => {
    setIsLoadingSections(true);
    try {
      if (!accessToken) {
        accessToken = await getAccessToken();
      }
      
      // 初始化Graph客户端
      const client = Client.init({
        authProvider: (done) => {
          done(null, accessToken);
        }
      });
      
      // 获取分区列表
      const sectionsResult = await client.api(`/me/onenote/notebooks/${notebookId}/sections`).get();
      setSections(sectionsResult.value || []);
      
      console.log('获取到的分区列表:', sectionsResult.value.map(s => s.displayName));
      
      // 如果有分区，默认选择第一个
      if (sectionsResult.value && sectionsResult.value.length > 0) {
        setSelectedSection(sectionsResult.value[0].id);
      }
    } catch (err) {
      console.error('获取分区列表失败:', err);
      console.error('错误详情:', err.message, err.statusCode, err.responseBody);
      setError('获取分区列表失败，请稍后重试');
    } finally {
      setIsLoadingSections(false);
    }
  };

  // 获取笔记本列表
  const fetchNotebooks = async () => {
    setIsLoadingNotebooks(true);
    try {
      const accessToken = await getAccessToken();
      
      // 初始化Graph客户端
      const client = Client.init({
        authProvider: (done) => {
          done(null, accessToken);
        }
      });
      
      // 获取笔记本列表
      const notebooksResult = await client.api('/me/onenote/notebooks').get();
      setNotebooks(notebooksResult.value || []);
      
      console.log('获取到的笔记本列表:', notebooksResult.value.map(n => n.displayName));
      
      // 如果有笔记本，默认选择第一个
      if (notebooksResult.value && notebooksResult.value.length > 0) {
        setSelectedNotebook(notebooksResult.value[0].id);
        // 获取该笔记本的分区列表
        fetchSections(notebooksResult.value[0].id, accessToken);
      }
    } catch (err) {
      console.error('获取笔记本列表失败:', err);
      setError('获取笔记本列表失败，请稍后重试');
    } finally {
      setIsLoadingNotebooks(false);
    }
  };

  // 检查登录状态
  const checkLoginStatus = useCallback(() => {
    if (!isMsalInitialized) return;
    
    const accounts = pca.getAllAccounts();
    if (accounts.length > 0) {
      // 设置活跃账户，确保后续的token请求能找到账户
      pca.setActiveAccount(accounts[0]);
      setIsLoggedIn(true);
      setUserName(accounts[0].name || '用户');
      // 获取笔记本列表
      fetchNotebooks();
    } else {
      setIsLoggedIn(false);
      setUserName('');
      setNotebooks([]);
      setSelectedNotebook('');
      setSections([]);
      setSelectedSection('');
    }
  }, [isMsalInitialized]);

  // 初始化 MSAL
  useEffect(() => {
    const initializeMsal = async () => {
      try {
        await pca.initialize();
        setIsMsalInitialized(true);
        // 初始化后检查登录状态
        checkLoginStatus();
      } catch (err) {
        console.error('MSAL初始化失败:', err);
        setError('MSAL初始化失败');
      }
    };
    initializeMsal();
  }, [checkLoginStatus]);

  // 创建 Graph API 客户端
  const getGraphClient = async () => {
    // 检查 MSAL 是否已初始化
    if (!isMsalInitialized) {
      throw new Error('MSAL 尚未初始化');
    }
    
    // 获取所有账户
    const accounts = pca.getAllAccounts();
    if (accounts.length === 0) {
      throw new Error('用户未登录，请先登录');
    }

    // 获取活跃账户
    const account = pca.getActiveAccount() || accounts[0];
    pca.setActiveAccount(account);
    
    // 确保获取最新的访问令牌
    let accessTokenResult;
    try {
      // 首先尝试静默获取令牌
      accessTokenResult = await pca.acquireTokenSilent({
        account,
        scopes: ['User.Read', 'Notes.ReadWrite.All', 'Notes.Create']
      });
    } catch (silentError) {
      // 静默获取失败，尝试交互式获取
      accessTokenResult = await pca.acquireTokenPopup({
        account,
        scopes: ['User.Read', 'Notes.ReadWrite.All', 'Notes.Create']
      });
    }
    
    // 确保获取到了有效的令牌
    if (!accessTokenResult || !accessTokenResult.accessToken) {
      throw new Error('无法获取有效的访问令牌');
    }
    
    const accessToken = accessTokenResult.accessToken;
    
    // 初始化Graph客户端
    const client = Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      }
    });
    
    return client;
  };

  // 登录
  const login = async () => {
    if (!isMsalInitialized) {
      setError('MSAL 正在初始化，请稍后再试');
      return;
    }
    
    try {
      // 配置登录选项，使用redirectUri而不是依赖默认的弹窗关闭检查
      const loginResponse = await pca.loginPopup({
        scopes: ['User.Read', 'Notes.ReadWrite.All', 'Notes.Create'],
        redirectUri: window.location.origin,
        // 禁用弹窗关闭检查，避免COOP警告
        prompt: 'select_account'
      });
      // 显式设置活跃账户
      pca.setActiveAccount(loginResponse.account);
      checkLoginStatus();
      setStatus('登录成功！');
    } catch (err) {
      // 忽略COOP相关的警告，只处理真正的错误
      if (err.toString().includes('Cross-Origin-Opener-Policy') || err.toString().includes('COOP')) {
        // 登录可能已经成功，检查登录状态
        checkLoginStatus();
        setStatus('登录成功！');
      } else {
        console.error('登录失败:', err);
        setError('登录失败，请重试');
      }
    }
  };

  // 登出
  const logout = async () => {
    if (!isMsalInitialized) {
      setError('MSAL 正在初始化，请稍后再试');
      return;
    }
    
    try {
      await pca.logout();
      checkLoginStatus();
      setStatus('已登出');
    } catch (err) {
      console.error('登出失败:', err);
      setError('登出失败，请重试');
    }
  };

  // 提取网页内容
  const extractContent = async () => {
    if (!url) {
      setError('请输入要提取的链接');
      return;
    }

    setStatus('正在提取内容...');
    setError('');

    // 定义CORS代理服务器列表（所有环境统一使用本地代理路由，由服务器端处理跨域）
    const proxyServers = [
      // 首选代理服务器：codetabs API（使用本地代理）
      `/api/proxy/?quest=${encodeURIComponent(url)}`,
      // 备用代理服务器：webpagesnap.com API（使用本地代理）
      `/api/webpagesnap?url=${encodeURIComponent(url)}`,
      // 备用代理服务器：allorigins API（使用本地代理）
      `/api/allorigins?url=${encodeURIComponent(url)}`,
    ];

    let proxyResponse = null;
    let proxyError = null;

    // 尝试使用不同的代理服务器
    for (let i = 0; i < proxyServers.length; i++) {
      try {
        console.log(`尝试使用代理${i+1}: ${proxyServers[i]}`);
        
        // 设置请求超时（15秒，增加超时时间提高成功率）
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          console.log(`代理${i+1}请求超时`);
          controller.abort();
        }, 15000);
        
        // 使用完整的浏览器headers，模拟真实浏览器请求
        proxyResponse = await fetch(proxyServers[i], {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.8,en-US;q=0.5,en;q=0.3',
            'Accept-Encoding': 'gzip, deflate, br',
            'Referer': window.location.origin,
            'Connection': 'keep-alive',
            'Cache-Control': 'max-age=0',
            'Upgrade-Insecure-Requests': '1',
            'DNT': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'cross-site',
            'Sec-Fetch-User': '?1'
          },
          // 不指定keepalive，使用浏览器默认设置
        });
        
        clearTimeout(timeoutId);
        
        console.log(`代理${i+1}响应状态: ${proxyResponse.status}`);
        
        // 检查响应状态
        if (proxyResponse.ok) {
          // 代理服务器工作正常，跳出循环
          console.log(`使用代理${i+1}成功`);
          break;
        } else {
          proxyError = new Error(`代理服务器错误: ${proxyResponse.status}`);
          console.error(`使用代理${i+1}失败: ${proxyError.message}`);
        }
      } catch (err) {
        proxyError = err;
        console.error(`使用代理${i+1}失败:`, err);
        // 如果是CORS错误，尝试下一个代理
        if (err.toString().includes('CORS')) {
          continue;
        }
        // 如果是超时错误，尝试下一个代理
        if (err.name === 'AbortError') {
          continue;
        }
      }
    }

    // 如果所有代理都失败，尝试直接请求（不使用代理）
    if (!proxyResponse || !proxyResponse.ok) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        proxyResponse = await fetch(url, {
          signal: controller.signal,
          // 添加常见的浏览器头信息，模拟浏览器请求
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'zh-CN,zh;q=0.8,en-US;q=0.5,en;q=0.3',
            'Connection': 'keep-alive',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          // 禁用HTTP/2
          keepalive: true
        });
        
        clearTimeout(timeoutId);
      } catch (err) {
        proxyError = err;
        console.error('直接请求失败:', err);
      }
    }

    try {
      if (!proxyResponse || !proxyResponse.ok) {
        if (proxyError && (proxyError.toString().includes('ERR_QUIC_PROTOCOL') || proxyError.toString().includes('ERR_HTTP2_PROTOCOL'))) {
          throw new Error('网络连接错误(QUIC/HTTP2协议)，请尝试使用其他网络或稍后再试');
        } else if (proxyError && proxyError.toString().includes('AbortError')) {
          throw new Error('请求超时，请检查网络连接后重试');
        } else if (proxyError && proxyError.toString().includes('CORS')) {
          throw new Error('跨域访问限制，请尝试其他链接或稍后再试');
        }
        throw proxyError || new Error('无法连接到目标网站，请检查网络或链接是否有效');
      }
      
      // 先获取文本内容，再尝试解析JSON
      let htmlContent = await proxyResponse.text();
      
      try {
        // 检查响应内容是否为JSON格式（代理服务器返回）
        if (htmlContent.startsWith('{')) {
          const data = JSON.parse(htmlContent);
          // 根据不同代理服务器的响应格式提取HTML内容
          if (data.contents) {
            htmlContent = data.contents;
          } else if (typeof data.contents === 'object' && data.contents.rendered) {
            htmlContent = data.contents.rendered;
          } else if (data.data && data.data.contents) {
            htmlContent = data.data.contents;
          } else if (data.responseText) {
            htmlContent = data.responseText;
          } else if (data.result) {
            htmlContent = data.result;
          }
        }
      } catch {
        // 如果解析JSON失败，直接使用文本作为HTML内容
        console.log('响应不是JSON格式或解析失败，直接使用文本内容');
      }
      
      // 解析HTML内容
      const doc = parser.parseFromString(htmlContent, 'text/html');
      
      // 尝试多种方法提取内容，提高成功率
      let articleData = null;
      
      try {
        // 方法1：使用Readability提取内容
        const reader = new Readability(doc);
        articleData = reader.parse();
        
        if (articleData && articleData.content) {
          console.log('使用Readability成功提取内容');
        } else {
          console.log('Readability提取失败，尝试备用方法');
          
          // 方法2：尝试直接从body提取内容
          const bodyContent = doc.body.innerHTML;
          if (bodyContent) {
            articleData = {
              title: doc.title || '无标题',
              content: bodyContent,
              excerpt: ''
            };
            console.log('使用直接提取body内容成功');
          }
        }
      } catch (readabilityError) {
        console.error('Readability处理出错:', readabilityError);
        
        // 方法3：出错时尝试直接从body提取内容
        try {
          const bodyContent = doc.body.innerHTML;
          if (bodyContent) {
            articleData = {
              title: doc.title || '无标题',
              content: bodyContent,
              excerpt: ''
            };
            console.log('出错后使用直接提取body内容成功');
          }
        } catch (bodyError) {
          console.error('直接提取body内容也失败:', bodyError);
        }
      }
      
      if (articleData) {
        // 构造与mercury-parser兼容的结果格式
        const result = {
          title: articleData.title,
          content: articleData.content,
          excerpt: articleData.excerpt,
          url: url
        };
        setArticle(result);
        setEditableContent(result.content);
        setStatus('内容提取成功！');
      } else {
        // 最后尝试：如果所有方法都失败，使用简化的HTML内容
        try {
          const simplifiedContent = `<div>${doc.body.textContent.substring(0, 1000)}...</div>`;
          articleData = {
            title: doc.title || '无标题',
            content: simplifiedContent,
            excerpt: ''
          };
          
          const result = {
            title: articleData.title,
            content: articleData.content,
            excerpt: articleData.excerpt,
            url: url
          };
          setArticle(result);
          setEditableContent(result.content);
          setStatus('内容提取成功（简化版）！');
          console.log('使用简化内容提取成功');
        } catch (finalError) {
          console.error('所有提取方法都失败:', finalError);
          throw new Error('无法提取网页内容，请检查链接是否有效或页面结构是否复杂');
        }
      }
    } catch (err) {
      console.error('提取内容失败:', err);
      setError(`提取内容失败: ${err.message}`);
      setStatus('');
    }
  };

  // 保存到 OneNote
  const saveToOneNote = async () => {
    if (!article) {
      setError('请先提取内容');
      return;
    }

    setStatus('正在保存到 OneNote...');
    setError('');

    try {
      // 使用Microsoft Graph Client库的正确方式调用API
      console.log('开始保存到 OneNote');
      
      // 检查是否有选中的分区
      if (!selectedSection) {
        console.error('没有选中的分区，正在重新获取笔记本和分区列表');
        // 重新获取笔记本和分区列表
        await fetchNotebooks();
        
        // 如果仍然没有选中的分区，抛出错误
        if (!selectedSection) {
          throw new Error('无法找到或创建21note分区，请检查OneNote配置');
        }
      }
      
      // 获取访问令牌
      const accessToken = await getAccessToken();
      console.log('获取到访问令牌，长度:', accessToken.length);
      
      // 构建页面内容
      const pageContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${article.title || 'Untitled'}</title>
        </head>
        <body>
          <h1>${article.title || 'Untitled'}</h1>
          <p>原文链接: <a href="${url}">${url}</a></p>
          ${editableContent || '无内容'}
        </body>
        </html>
      `;

      // 使用Microsoft Graph Client库调用API
      console.log('准备调用OneNote API，页面内容长度:', pageContent.length);
      console.log('保存到分区ID:', selectedSection);
      
      // 初始化Graph客户端
      const client = Client.init({
        authProvider: (done) => {
          done(null, accessToken);
        }
      });
      
      // 调用OneNote API，保存到指定分区
      const response = await client.api(`/me/onenote/sections/${selectedSection}/pages`)
        .header('Content-Type', 'application/xhtml+xml')
        .post(pageContent);
      
      console.log('保存到 OneNote 成功，响应:', response);

      setStatus('保存到 OneNote 成功！');
    } catch (err) {
      console.error('保存到 OneNote 失败:', err);
      console.error('错误详情:', err.message, err.statusCode, err.responseBody);
      setError('保存到 OneNote 失败，请检查登录状态或稍后重试');
      setStatus('');
    }
  };

  // 处理内容编辑
  const handleContentChange = (e) => {
    setEditableContent(e.target.innerHTML);
  };

  // 处理标题编辑
  const handleTitleChange = (e) => {
    if (article) {
      setArticle({
        ...article,
        title: e.target.value
      });
    }
  };

  // 截断长链接
  const truncateUrl = (url, maxLength = 50) => {
    if (url.length <= maxLength) {
      return url;
    }
    return `${url.substring(0, maxLength)}...`;
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>web2onenote</h1>
        <p>提取网页内容并保存到 OneNote</p>
        <div className="login-section">
          {isLoggedIn ? (
            <div className="user-info">
              <span>欢迎，{userName}</span>
              <button onClick={logout} className="logout-btn">登出</button>
            </div>
          ) : (
            <button onClick={login} className="login-btn">登录 Microsoft 账户</button>
          )}
        </div>
      </header>

      <main className="app-main">
        <section className="input-section">
          <div className="url-input-container">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="请输入网页链接"
              className="url-input"
            />
            <button onClick={extractContent} className="extract-btn">
              提取内容
            </button>
          </div>
          
          {status && <div className="status-message">{status}</div>}
          {error && <div className="error-message">{error}</div>}
        </section>

        {article && (
          <section className="content-section">
            <div className="content-header">
              <div className="title-edit-container">
                <input
                  type="text"
                  value={article.title || ''}
                  onChange={handleTitleChange}
                  className="title-input"
                  placeholder="请输入标题"
                />
              </div>
              <button onClick={saveToOneNote} className="save-btn">
                保存到 OneNote
              </button>
            </div>
            
            {isLoggedIn && (
              <div className="onenote-settings">
                <div className="settings-row">
                  <label htmlFor="notebook-select">选择笔记本:</label>
                  <div className="select-container">
                    <select
                      id="notebook-select"
                      value={selectedNotebook}
                      onChange={(e) => {
                        setSelectedNotebook(e.target.value);
                        // 当选择新的笔记本时，获取该笔记本的分区列表
                        fetchSections(e.target.value);
                      }}
                      disabled={isLoadingNotebooks}
                      className="settings-select"
                    >
                      <option value="">请选择笔记本</option>
                      {notebooks.map(notebook => (
                        <option key={notebook.id} value={notebook.id}>
                          {notebook.displayName}
                        </option>
                      ))}
                    </select>
                    {isLoadingNotebooks && <span className="loading-indicator">加载中...</span>}
                  </div>
                </div>
                
                <div className="settings-row">
                  <label htmlFor="section-select">选择分区:</label>
                  <div className="select-container">
                    <select
                      id="section-select"
                      value={selectedSection}
                      onChange={(e) => setSelectedSection(e.target.value)}
                      disabled={isLoadingSections || !selectedNotebook}
                      className="settings-select"
                    >
                      <option value="">请选择分区</option>
                      {sections.map(section => (
                        <option key={section.id} value={section.id}>
                          {section.displayName}
                        </option>
                      ))}
                    </select>
                    {isLoadingSections && <span className="loading-indicator">加载中...</span>}
                  </div>
                </div>
              </div>
            )}
            
            <div className="content-preview">
              <p className="source-link">
                <strong>原文链接:</strong> 
                <a href={url} target="_blank" rel="noopener noreferrer" title={url}>
                  {truncateUrl(url)}
                </a>
              </p>
              
              {article.excerpt && (
                <div className="excerpt">
                  <strong>摘要:</strong> {article.excerpt}
                </div>
              )}
              
              <div 
                className="content" 
                contentEditable 
                suppressContentEditableWarning={true}
                onInput={handleContentChange}
                dangerouslySetInnerHTML={{ __html: editableContent }}
              />
            </div>
          </section>
        )}
      </main>
      
      <footer className="app-footer">
        <p>by <a href="https://hin.cool" target="_blank" rel="noopener noreferrer">w4j1e</a></p>
      </footer>
    </div>
  );
}

export default App;