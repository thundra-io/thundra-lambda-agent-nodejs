class AuditInfo {
    id: string;
    contextName: string;
    openTimestamp: number;
    closeTimestamp: number;
    aliveTime: number;
    errors: any;
    thrownError: string;
    duration: number;
    children: AuditInfo[] = new Array<AuditInfo>();
    props: any = {};
    contextType: string;
    contextGroup: string;
}

export default AuditInfo;