import { logAudit, configureAuditSink, type AuditEntry, type AuditSink } from '../audit';

const baseEntry: AuditEntry = {
  actor: { id: 'u1', role: 'client' },
  action: 'case.read',
  resourceType: 'case_record',
  resourceId: 'case-1',
  outcome: 'success',
};

describe('logAudit', () => {
  it('writes through a configured sink with an occurredAt timestamp', async () => {
    const writes: Array<AuditEntry & { occurredAt: string }> = [];
    const sink: AuditSink = {
      async write(entry) {
        writes.push(entry);
      },
    };
    configureAuditSink(sink);

    await logAudit(baseEntry);

    expect(writes).toHaveLength(1);
    expect(writes[0]!.action).toBe('case.read');
    expect(typeof writes[0]!.occurredAt).toBe('string');
    expect(Number.isNaN(Date.parse(writes[0]!.occurredAt))).toBe(false);
  });

  it('never throws when the sink fails', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    configureAuditSink({
      async write() {
        throw new Error('sink down');
      },
    });
    await expect(logAudit(baseEntry)).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
