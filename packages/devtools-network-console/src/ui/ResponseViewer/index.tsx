// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as React from 'react';
import { connect, useDispatch, useSelector } from 'react-redux';
import {
    DataGrid,
    DataGridColumn,
    DataGridCellRenderConfig,
    LightweightButton,
    Pivot,
    Progress,
} from '@microsoft/fast-components-react-msft';
import { DesignSystemProvider } from '@microsoft/fast-jss-manager-react';
import { DataGridHeaderRenderConfig } from '@microsoft/fast-components-react-base';

import CanonicalHeaderName from '../CanonicalHeaderName';
import { INetConsoleResponseInternal } from 'model/NetConsoleRequest';
import * as Styles from './styles';
import CommonStyles from 'ui/common-styles';
import CookiesTable from './CookiesTable';
import { IView } from 'store';
import preview from './preview';
import Stats from './Stats';
import { THEME_TYPE } from 'themes/vscode-theme';
import { AppHost } from 'store/host';
import ResponseBody from './ResponseBody';
import ContainerWithStatusBar from 'ui/generic/ContainerWithStatusBar';
import { HideUnless } from 'ui/generic/HideIf';
import LocText from 'ui/LocText';
import { ILocalized, LocalizationConsumer } from 'utility/loc-context';
import TableHeader from './table/TableHeader';
import { cancelRequestAction } from 'actions/response';

interface IConnectedProps {
    response: INetConsoleResponseInternal;
    theme: THEME_TYPE;
}
export interface IOwnProps {
    requestId: string;
}
export type IResponseViewerProps = IConnectedProps & IOwnProps;

const headersColumns: DataGridColumn[] = [
    {
        columnDataKey: 'key',
        title: 'Name',
        columnWidth: '20%',
        cell: (config: DataGridCellRenderConfig) => {
            return (
                <div role="gridcell" className={config.classNames}>
                    <CanonicalHeaderName header={(config.rowData as any)[config.columnDataKey]} />
                </div>
            );
        },
        header: (config: DataGridHeaderRenderConfig) => <TableHeader key={config.key} config={config} locBase="ResponseHeaders.Header" />,
    },
    {
        columnDataKey: 'value',
        title: 'Value',
        columnWidth: '75%',
        header: (config: DataGridHeaderRenderConfig) => <TableHeader key={config.key} config={config} locBase="ResponseHeaders.Header" />,
    },
];

type ActivityState = 'preview' | 'body' | 'headers' | 'cookies';
const PIVOT_DEFAULT_ITEMS = [{
    tab: (cn: string) => <div className={cn}>
                            <LocText textKey="Response.Pivot.bodyLabel" />
                         </div>,
    content: () => <></>,
    id: 'body',
}, {
    tab: (cn: string) => <div className={cn}>
                            <LocText textKey="Response.Pivot.headersLabel" />
                         </div>,
    content: () => <></>,
    id: 'headers',
}, {
    tab: (cn: string) => <div className={cn}>
                            <LocText textKey="Response.Pivot.cookiesLabel" />
                         </div>,
    content: () => <></>,
    id: 'cookies',
}];
const PIVOT_PREVIEW_ITEM = {
    tab: (cn: string) => <div className={cn}>
                            <LocText textKey="Response.Pivot.previewLabel" />
                         </div>,
    content: () => <></>,
    id: 'preview',
};

export function ResponseViewer(props: IResponseViewerProps) {
    return (
        <LocalizationConsumer>
            {locale => <ResponseViewerWithLocale {...props} locale={locale} />}
        </LocalizationConsumer>
    );
}

function ResponseViewerWithLocale(props: IResponseViewerProps & ILocalized) {
    // TODO: Promote to per-request state in the Store
    const [currentTab, setCurrentTab] = React.useState<ActivityState>('body');
    const headerData = React.useMemo(() => {
        if (props.response.status === 'COMPLETE' && props.response.response) {
            return props.response.response.headers.map((h, index) => {
                const rowKey = `r${props.requestId}h${index}`;
                return {
                    ...h,
                    rowKey,
                };
            });
        }
        return [];
    }, [props.requestId, props.response.status, props.response.response]);
    let languageChoice = 'text';
    let contentType = '';
    if (props.response.status === 'COMPLETE' && props.response.response) {
        const contentTypeHeader = props.response.response.headers.find(h => h.key === 'content-type');
        if (contentTypeHeader) {
            contentType = contentTypeHeader.value;

            switch (contentTypeHeader.value) {
                case 'application/json':
                case 'application/json; charset=utf-8':
                case 'text/json':
                case 'text/x-json':
                    languageChoice = 'json';
                    break;
                case 'text/javascript':
                case 'application/javascript':
                case 'application/x-javascript':
                    languageChoice = 'javascript';
                    break;
                case 'text/typescript':
                case 'application/typescript':
                    languageChoice = 'typescript';
                    break;
                case 'text/plain':
                    break;
                default:
                    if (contentTypeHeader.value.indexOf('/json') > -1) {
                        languageChoice = 'json';
                    }
                    else if (contentTypeHeader.value.indexOf('html') > -1) {
                        languageChoice = 'html';
                    }
                    else if (contentTypeHeader.value.indexOf('/javascript') > -1 || contentTypeHeader.value.indexOf('/x-javascript') > -1) {
                        languageChoice = 'javascript';
                    }
                    else if (contentTypeHeader.value.indexOf('/typescript') > -1) {
                        languageChoice = 'typescript';
                    }
                    break;
            }
        }
    }

    if (props.response.status === 'PENDING') {
        return <Pending requestId={props.requestId} />;
    }
    else if (props.response.status === 'ERROR_BELOW_APPLICATION_LAYER') {
        return <ErrorBelowApplication />;
    }
    else if (props.response.status === 'NOT_SENT' || !props.response.response) {
        return <NotIssued />;
    }

    const renderedPreview = preview(props.response.response.body.content, contentType, props.locale);
    const tabsToDisplay = PIVOT_DEFAULT_ITEMS.slice();
    if (!!renderedPreview) {
        tabsToDisplay.unshift(PIVOT_PREVIEW_ITEM);
    }

    return (
        <ContainerWithStatusBar>
            <div className="response-tabs" {...Styles.HEIGHT_100}>
                <DesignSystemProvider designSystem={{ density: 2 }}>
                <Pivot
                    activeId={currentTab}
                    items={tabsToDisplay}
                    label="Choose views of the response data"
                    onUpdate={activeTab => setCurrentTab(activeTab as ActivityState)}
                    />
                </DesignSystemProvider>
                {!!renderedPreview && (
                <HideUnless test={currentTab} match="preview" className={renderedPreview.className}>
                    {renderedPreview.child}
                </HideUnless>
                )}
                <HideUnless test={currentTab} match="body" className="editor-container">
                    <ResponseBody
                        languageChoice={languageChoice}
                        requestId={props.requestId}
                        theme={props.theme}
                        serializedBody={props.response.response.body}
                        size={props.response.response.size}
                        />
                </HideUnless>
                <HideUnless test={currentTab} match="headers" {...CommonStyles.SCROLL_CONTAINER_STYLE}>
                    <div {...CommonStyles.SCROLLABLE_STYLE}>
                        <DataGrid
                            rows={headerData}
                            columns={headersColumns}
                            dataRowKey="rowKey"
                            virtualize={false}
                            />
                    </div>
                </HideUnless>
                <HideUnless test={currentTab} match="cookies" {...CommonStyles.SCROLL_CONTAINER_STYLE}>
                    <div {...CommonStyles.SCROLLABLE_STYLE}>
                        <CookiesTable headers={props.response.response.headers} />
                    </div>
                </HideUnless>
            </div>

            <Stats
                duration={props.response.duration}
                size={props.response.response.size}
                statusCode={props.response.response.statusCode}
                statusText={props.response.response.statusText}
                requestId={props.requestId}
                />
        </ContainerWithStatusBar>
    );
}

function NotIssued() {
    return (
        <div {...Styles.NO_REQ_STYLE}>
            <div>
                <LocText textKey="Response.requestNotIssuedLabel" />
            </div>
        </div>
    );
}

function Pending({ requestId }: { requestId: string; }) {
    const dispatch = useDispatch();
    const cookie = useSelector<IView, number | undefined>(state => state.response.get(requestId)?.cookie);
    return (
        <div {...Styles.NO_REQ_STYLE}>
            <div>
                <Progress circular style={{ transform: 'scale(2.0) translateY(-12px)' }} />
            </div>
            <div>
                <LocText textKey="Response.requestPendingLabel" />
            </div>
            {requestId && cookie && (<div>
                <LightweightButton onClick={_e => dispatch(cancelRequestAction(requestId, cookie))}>
                    <LocText textKey="Response.cancel" />
                </LightweightButton>
            </div>)}
        </div>
    );
}

function ErrorBelowApplication() {
    return (
        <div {...Styles.NO_REQ_STYLE} style={{display: 'flex', flexFlow: 'column nowrap', alignItems: 'stretch', margin: '20px'}}>
            <h2>
                <LocText textKey="Response.requestFailedTitleLabel" />
            </h2>
            <p>
                <LocText textKey="Response.requestFailedDescriptionLabel" />
            </p>
        </div>
    );
}

function mapStateToProps(state: IView, ownProps: IOwnProps): IConnectedProps {
    const response = state.response.get(ownProps.requestId);
    if (!response) {
        AppHost.log({
            message: 'Invariant failure, no response for ID',
            where: 'ResponseViewer:mapStateToProps',
            state,
            ownProps,
            response,
        });
        throw new Error('Invariant failed: Response not found for given request ID');
    }

    return {
        response: response,
        theme: state.theme.theme,
    };
}

export const ConnectedResponseViewer = connect(mapStateToProps)(ResponseViewer);
export default ConnectedResponseViewer;
