import { ProfileReq, ProfileServ } from '../index.js'
import { Cfg, Data } from '../../components/index.js'
import MysAvatar from './MysAvatar.js'

import enkaApi from './EnkaApi.js'
import miaoApi from './MiaoApi.js'
import mggApi from './MggApi.js'

let { diyCfg } = await Data.importCfg('profile')

const Profile = {
  servs: {},
  serv (key) {
    if (!Profile.servs[key]) {
      Profile.servs[key] = new ProfileServ({
        miao: miaoApi,
        mgg: mggApi,
        enka: enkaApi
      }[key])
    }
    return Profile.servs[key]
  },

  /**
   * 根据UID分配请求服务器
   * @param uid
   * @returns {ProfileServ}
   */
  getServ (uid) {
    let token = diyCfg?.miaoApi?.token
    let qq = diyCfg?.miaoApi?.qq
    let hasToken = !!(qq && token && token.length === 32 && !/^test/.test(token))

    // 判断国服、B服、外服，获取在配置中的idx
    let servIdx = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1, 6: 2, 7: 2, 8: 2, 9: 2 }[uid[0]]

    // 获取对应服务选择的配置数字，0自动，1喵，2Enka，3Mgg
    let servCfg = Cfg.get('profileServer', '0').toString() || '0'
    servCfg = servCfg[servIdx] || servCfg[0] || '0'

    if ((servCfg === '0' || servCfg === '1') && hasToken) {
      return Profile.serv('miao')
    }
    if (servCfg === '2') {
      return Profile.serv('enka')
    } else if (servCfg === '3') {
      return Profile.serv('mgg')
    }
    return Profile.serv(servIdx === 2 ? 'enka' : 'mgg')
  },

  /**
   * 更新面板数据
   * @param player
   * @param force
   * @returns {Promise<boolean|number>}
   */
  async refreshProfile (player, force = 2) {
    if (!MysAvatar.needRefresh(player._profile, force, { 0: 24, 1: 2, 2: 0 })) {
      return false
    }
    player._update = []
    let { uid, e } = player
    if (uid.toString().length !== 9 || !e) {
      return false
    }
    let req = ProfileReq.create(e)
    if (!req) {
      return false
    }
    let serv = Profile.getServ(uid)
    try {
      await req.requestProfile(player, serv)
      player._profile = new Date() * 1
      player.save()
      return player._update.length
    } catch (err) {
      if (!e._isReplyed) {
        e.reply(`UID:${uid}更新面板失败，更新服务：${serv.name}`)
      }
      return false
    }
  },

  isProfile (avatar) {
    // 检查数据源
    if (!avatar._source || !['enka', 'change', 'miao', 'mgg'].includes(avatar._source)) {
      return false
    }
    // 检查武器及天赋
    if (!avatar.weapon || !avatar.talent) {
      return false
    }
    // 检查圣遗物词条是否完备
    if (!avatar.artis || !avatar.artis.hasAttr) {
      return false
    }
    // 检查旅行者
    if (['空', '荧'].includes(avatar.name)) {
      return !!avatar.elem
    }
    return true
  }
}

export default Profile
