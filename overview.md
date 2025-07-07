更新后的 overview.md  
Last-Updated: 2025-07-04

# 專案概述

## 專案結構


- **/** (專案根目錄)
    - **mcp-project-overview/**  
        - **src/**  
            - **cmd/**  
                - `generateOverview.ts`  
            - `index.ts`  
            - **utils/**  
                - `chroma.test.ts`  
                - `chroma.ts`  
                - `fileProcessing.ts`  
                - `langchain.ts`  
                - `logger.ts`  

- **overview.md**: 本檔案，提供專案概述與架構說明。  

### 核心專案


#### mcp-project-overview

此目錄為輔助工具與專案分析程式碼，位於 StorageSystem 專案下，主要用於自動化專案文件和向量資料庫管理。  

- **src/cmd/generateOverview.ts**  
  完整路徑: `/Users/pengpeng/Documents/13_mcp_server/mcp-project-overview/src/cmd/generateOverview.ts`  
  此程式定義非同步函式 `generateProjectOverview`，用於建立或更新專案概述 Markdown 檔案。它從指定目錄讀取全部源碼檔案，將內容依來源分組，並利用 OpenAI GPT-4.1-mini 模型生成摘要。接著讀取現有 overview 文件，透過模型整合新摘要，並移除已刪除檔案的條目，最後將更新後內容寫回檔案。整個流程帶有詳細日誌記錄，並在錯誤時適當處理。  

- **src/index.ts**  
  完整路徑: `/Users/pengpeng/Documents/13_mcp_server/mcp-project-overview/src/index.ts`  
  此 TypeScript 程式碼設定一個名為 "project-overview-server" 的 MCP 伺服器，專用於分析程式專案。註冊三個主要工具：  
  1. **vector-add**：利用 OpenAI 的嵌入模型，將類別/函式的說明加入 Chroma 向量資料庫以支援語意搜尋。  
  2. **vector-search**：執行語意搜尋，可依型別、名稱與命名空間過濾結果。  
  3. **generate-overview**：分析目標目錄下的原始碼，產生專案概述摘要並儲存為 Markdown。  
  伺服器使用 OpenAI API 金鑰來產生嵌入，藉由標準輸入輸出通訊，並提供錯誤處理與金鑰缺失警告。  

- **src/utils/chroma.test.ts**  
  完整路徑: `/Users/pengpeng/Documents/13_mcp_server/mcp-project-overview/src/utils/chroma.test.ts`  
  使用 Jest 撰寫的測試套件，驗證 Chroma 向量資料庫相關工具函式的行為。透過 LangChain 與 OpenAI 嵌入模型進行功能測試，包括建立 Chroma 集合、加入測試文件、產生嵌入及執行相似度搜尋。測試確保向量運算正確且系統能妥善處理錯誤。  

- **src/utils/chroma.ts**  
  完整路徑: `/Users/pengpeng/Documents/13_mcp_server/mcp-project-overview/src/utils/chroma.ts`  
  封裝與 Chroma 向量資料庫互動的工具函式，包含初始化 Chroma store（結合 OpenAI 嵌入）、新增文件、執行相似度搜尋及清理集合。程式碼具備錯誤處理與日誌紀錄以提升健壯性。  

- **src/utils/fileProcessing.ts**  
  完整路徑: `/Users/pengpeng/Documents/13_mcp_server/mcp-project-overview/src/utils/fileProcessing.ts`  
  提供讀取目錄中原始碼與 Markdown 檔案、依來源分組、內容切分與摘要生成的工具函式。利用 ChatOpenAI 及 map-reduce 模式的摘要鏈，以自動化文件整理與更新。並包含讀寫專案概述檔案的輔助方法。  

- **src/utils/langchain.ts**  
  完整路徑: `/Users/pengpeng/Documents/13_mcp_server/mcp-project-overview/src/utils/langchain.ts`  
  匯出兩個函式用於初始化 LangChain 的 OpenAI 服務：  
  - 初始化 ChatOpenAI 模型（自訂聊天模型名稱及溫度）  
  - 產生文字嵌入，使用 `text-embedding-ada-002` 模型  
  均需提供 OpenAI API 金鑰以運作。  

- **src/utils/logger.ts**  
  完整路徑: `/Users/pengpeng/Documents/13_mcp_server/mcp-project-overview/src/utils/logger.ts`  
  配置 Winston 日誌系統，定義自訂的日誌級別與顏色。根據環境設定日誌等級（開發環境為 debug，其他為 info），使用時間戳與顏色格式化，輸出到主控台及輪替檔案（`logs/error.log` 記錄錯誤，`logs/combined.log` 記錄所有日誌），確保日誌管理清晰且易讀。  

1. **輔助工具層 (mcp-project-overview)**:  
    - 提供專案代碼的分析、文件自動生成與向量資料庫管理。  
    - 透過 OpenAI GPT 與 LangChain 技術，實現語意分析與文件摘要。  
    - 配合 CI/CD 可定期更新專案文件，提升維護效率。  
