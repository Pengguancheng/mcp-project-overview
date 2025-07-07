export type OverviewType = 'class' | 'interface' | 'function';

export interface IOverview {
  id: string;
  name: string;
  description: string;
  projectName: string;
  references: string[];
  contentType: OverviewType;
}

export class Overview implements IOverview {
  public contentType: OverviewType;
  public description: string;
  public id: string;
  public name: string;
  public projectName: string;
  public references: string[];
  public filePath: string;

  constructor(
    name: string,
    description: string,
    projectName: string,
    references: string[],
    contentType: OverviewType,
    filePath: string
  ) {
    this.id = `${projectName}-${name}-${contentType}`;
    this.name = name;
    this.description = description;
    this.projectName = projectName;
    this.references = references;
    this.contentType = contentType;
    this.filePath = filePath;
  }
}
