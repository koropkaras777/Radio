export class BaseModel {
  static table = '';
  static columns = {};
  static primaryKey = null;
  static indexes = [];
  static createTableSql = '';

  static getTableName() {
    return this.table;
  }

  static getColumns() {
    return this.columns;
  }

  static getPrimaryKey() {
    return this.primaryKey;
  }

  static getIndexes() {
    return this.indexes;
  }

  static getCreateTableSql() {
    return this.createTableSql;
  }
}
