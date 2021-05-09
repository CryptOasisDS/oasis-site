import { Vue, Component } from 'nuxt-property-decorator'
import Web3 from 'web3'
import BigNumber from 'bignumber.js'
import abiArray from '~/src/utils/abiArray'

interface ExtendedWindow extends Window {
  ethereum?: any
}

declare let window: ExtendedWindow

interface ITip {
  address: string
  tag: string
  avatar: string
  amount: string
}

@Component
export default class TipPage extends Vue {
  head () {
    return {
      title: 'Oasis tip platform'
    }
  }

  id: string | null = null
  tip: ITip | null = null
  txid: string | null = null
  web3: Web3 | null = null
  fromAddress: string | null = null
  chainId: string | null = null

  async beforeMount () {
    const { id } = this.$route.query

    const res = await fetch(`https://tipping-bot.herokuapp.com/tips/${id}`)

    this.id = id as string
    this.tip = await res.json()

    if (!window.ethereum) {
      alert('Please install metamask to use this application')

      return
    }

    this.chainId = window.ethereum.chainId
    console.log(this.chainId)

    this.web3 = new Web3(window.ethereum)
    try {
      await this.requestAccount()
    } catch (error) {
      console.log('Connect the account you bastard')
    }

    window.ethereum.on('accountsChanged', () => {
      this.fromAddress = null
    })

    window.ethereum.on('chainChanged', (chainId: string) => {
      this.chainId = chainId
    });
  }

  createTx (from, to, amount) {
    if (this.web3 === null) { return }

    const contractAddress = '0xd9c99510a5e3145359d91fe9caf92dd5d68b603a'
    // @ts-ignore
    const contract = new this.web3.eth.Contract(abiArray, contractAddress)
    const bnAmount = new BigNumber(amount)
    const exponential = (new BigNumber(10)).exponentiatedBy(9)
    const actualAmount = bnAmount.times(exponential)
    const data = contract.methods.transfer(to, actualAmount.toString()).encodeABI()
    const tx = {
      from, // Required
      to: contractAddress, // Required (for non contract deployments)
      data, // Required
      gasLimit: this.web3.utils.toHex(100000),
      gasPrice: this.web3.utils.toHex(this.web3.utils.toWei('5', 'gwei')), // Optional
      value: '0x00',
      networkId: 56,
      chainId: 56 // Optional
    }
    return tx
  }

  async sendTransaction () {
    if (this.tip === null) { return }

    const tx = this.createTx(
      this.fromAddress,
      this.tip.address,
      this.tip.amount
    )
    try {
      const txid = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [tx]
      })
      this.txid = txid

      await fetch(`${process.env.TIPPING_URL}/tips/${this.id}`, {
        headers: {
          'Content-Type': 'application/json'
        },
        method: 'POST',
        body: JSON.stringify({
          txid: this.txid
        })
      })
    } catch (error) {
      console.log('Why did you reject the transaction?')
    }
  }

  async requestAccount () {
    this.fromAddress = (
      await window.ethereum.request({ method: 'eth_requestAccounts' })
    )[0]
  }
}
