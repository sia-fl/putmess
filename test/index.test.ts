import { describe, expect, it } from 'vitest'
import {
  getmess,
  getmessPage,
  maclickhouse,
  maredis,
  putmess,
  putreadedmess,
  setclickhouse,
  setredis,
  syncreadedmess,
} from '../src'

const ckurl = process.env.CLICKHOUSE_URL as string
const redisurl = process.env.REDIS_URL as string

describe('should', () => {
  it('exported', async () => {
    const ck = maclickhouse({
      url: ckurl,
      database: 'confee',
      username: 'default',
      password: '0NV2wQyamqESRfK5',
    })
    setclickhouse(ck)
    await putmess([
      {
        user_id: 'admin',
        title: '测试标题',
        message_id: 'test_message_id',
        message_content: '测试审核',
        message_type: 'audit',
        version: 1,
      },
    ])
    let first = await getmess('admin', 'test_message_id')
    expect(first).toBeDefined()
    expect(first.version).toBe(1)
    const redis = maredis(redisurl)
    setredis(redis)
    await putreadedmess('admin', 'test_message_id')
    let messes = await getmessPage({ user_id: 'admin', page: 1, pageSize: 10 })
    expect(messes).toBeDefined()
    expect(messes).toBeInstanceOf(Array)
    expect(messes.length).toBeGreaterThan(0)
    expect(messes[0].version).toBe(2)
    first = await getmess('admin', 'test_message_id')
    expect(first).toBeDefined()
    expect(first.version).toBe(1)
    await putmess([
      {
        user_id: 'admin',
        title: '测试标题',
        message_id: 'test_message_id',
        message_content: '测试审核',
        message_type: 'audit',
        version: 2,
      },
    ])
    messes = await getmessPage({ user_id: 'admin', page: 1, pageSize: 10 })
    expect(messes.length).eq(1)
    expect(messes[0].version).toBe(2)
    await syncreadedmess('admin')
    /**
     * 再判断 redis 中已读消息的 message_id
     * 应该为空了
     */
    const readed = await redis.smembers(`readed:admin`)
    expect(readed).toBeDefined()
    expect(readed).toBeInstanceOf(Array)
    expect(readed.length).toBe(0)
  })
})
