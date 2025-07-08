export type OverviewType = 'class' | 'interface' | 'function';

export interface IOverview {
  id: string;
  name: string;
  content: string;
  projectName: string;
  references: string[];
  contentType: OverviewType;
  summary: string;
}

export class Overview implements IOverview {
  public contentType: OverviewType;
  public content: string;
  public id: string;
  public name: string;
  public projectName: string;
  public references: string[];
  public filePath: string;
  public summary: string;

  constructor(
    name: string,
    content: string,
    projectName: string,
    references: string[],
    contentType: OverviewType,
    filePath: string,
    summary: string
  ) {
    this.id = `${filePath}-${contentType}-${name}`;
    this.name = name;
    this.content = content;
    this.projectName = projectName;
    this.references = references;
    this.contentType = contentType;
    this.filePath = filePath;
    this.summary = summary;
  }
}
