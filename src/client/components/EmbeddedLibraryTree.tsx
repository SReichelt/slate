import * as React from 'react';
import './EmbeddedLibraryTree.css';
import * as Fmt from '../../shared/format/format';
import { LibraryDataProvider } from '../../shared/data/libraryDataProvider';
import LibraryTree, { OnFilter, OnItemClicked } from './LibraryTree';

export { OnFilter, OnItemClicked };

interface EmbeddedLibraryTreeProps {
  libraryDataProvider: LibraryDataProvider;
  templates?: Fmt.File;
  onFilter?: OnFilter;
  selectedItemPath?: Fmt.Path;
  onItemClicked?: OnItemClicked;
}

class EmbeddedLibraryTree extends React.Component<EmbeddedLibraryTreeProps> {
  private treePaneNode: HTMLElement | null;

  render(): React.ReactNode {
    return (
      <div className={'embedded-tree-pane'} ref={(htmlNode) => (this.treePaneNode = htmlNode)}>
        <div className={'embedded-tree'}>
          <LibraryTree libraryDataProvider={this.props.libraryDataProvider} templates={this.props.templates} parentScrollPane={this.treePaneNode} onFilter={this.props.onFilter} selectedItemPath={this.props.selectedItemPath} onItemClicked={this.props.onItemClicked}/>
        </div>
      </div>
    );
  }
}

export default EmbeddedLibraryTree;
