// 新增建構向量搜尋過濾器的函數
import { Document } from '@langchain/core/documents';

export function buildVectorSearchFilter(options: {
  type?: string;
  name?: string;
  namespace?: string;
  references?: string[];
  projectName?: string;
}): Record<string, any> {
  const { type, name, namespace, references, projectName } = options;

  const filters: any[] = [];

  // 項目名稱過濾
  if (projectName) {
    filters.push({
      projectName: { $eq: projectName },
    });
  }

  // 類型過濾
  if (type) {
    filters.push({
      type: { $eq: type },
    });
  }

  // 名稱過濾 (支援部分匹配)
  if (name) {
    filters.push({
      name: { $contains: name },
    });
  }

  // 命名空間過濾
  if (namespace) {
    filters.push({
      namespace: { $contains: namespace },
    });
  }

  // 引用關係過濾 (支援多個引用的任一匹配)
  if (references && references.length > 0) {
    const referenceFilters = references.map(ref => ({
      references: { $contains: ref },
    }));

    if (referenceFilters.length === 1) {
      filters.push(referenceFilters[0]);
    } else {
      filters.push({
        $or: referenceFilters,
      });
    }
  }

  // 如果沒有過濾條件，返回空過濾器
  if (filters.length === 0) {
    return {};
  }

  // 如果只有一個過濾條件，直接返回
  if (filters.length === 1) {
    return filters[0];
  }

  // 多個過濾條件使用 $and 組合
  return {
    $and: filters,
  };
}

// 格式化搜尋結果
// 格式化搜尋結果
export function formatSearchResults(results: Document[]): string {
  return results
    .map((doc, index) => {
      return doc.pageContent;
    })
    .join('\n\n');
}
