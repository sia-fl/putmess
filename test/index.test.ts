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
    /**
     * 清空 message 表
     */
    await ck.query({
      query: `TRUNCATE TABLE message`,
    })
    await putmess([
      {
        user_id: '75a3d536-894e-4e07-b6f9-6594d530c69a',
        title: '测试标题01',
        message_id: 'test_message_id01',
        message_content: '测试审核01',
        message_type: 'audit',
        version: 1,
      },
      {
        user_id: '75a3d536-894e-4e07-b6f9-6594d530c69a',
        title: '测试标题02',
        message_id: 'test_message_id02',
        message_content: '测试审核02',
        message_type: 'audit',
        version: 1,
      },
    ])
    let first = await getmess('75a3d536-894e-4e07-b6f9-6594d530c69a', 'test_message_id01')
    expect(first).toBeDefined()
    expect(first.version).toBe(1)
    const redis = maredis(redisurl)
    setredis(redis)
    await putreadedmess('75a3d536-894e-4e07-b6f9-6594d530c69a', 'test_message_id01')
    let messes = await getmessPage({ user_id: '75a3d536-894e-4e07-b6f9-6594d530c69a', page: 1, pageSize: 10 })
    expect(messes).toBeDefined()
    expect(messes).toBeInstanceOf(Object)
    expect(messes.list.length).toBe(2)
    first = await getmess('75a3d536-894e-4e07-b6f9-6594d530c69a', 'test_message_id01')
    expect(first).toBeDefined()
    expect(first.version).toBe(1)
    await putmess([
      {
        user_id: '75a3d536-894e-4e07-b6f9-6594d530c69a',
        title: '测试标题01',
        message_id: 'test_message_id01',
        message_content: '测试审核01',
        message_type: 'audit',
        version: 2,
      },
    ])
    messes = await getmessPage({ user_id: '75a3d536-894e-4e07-b6f9-6594d530c69a', page: 1, pageSize: 10 })
    expect(messes.list.length).eq(2)
    await syncreadedmess('75a3d536-894e-4e07-b6f9-6594d530c69a')
    /**
     * 再判断 redis 中已读消息的 message_id
     * 应该为空了
     */
    const readed = await redis.smembers(`readed:75a3d536-894e-4e07-b6f9-6594d530c69a`)
    expect(readed).toBeDefined()
    expect(readed).toBeInstanceOf(Array)
    expect(readed.length).toBe(0)
  })
})
