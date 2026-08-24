package §_-W§
{
   import §_-0H§.Item;
   import §_-0H§.Player;
   import §_-3i§.§_-Ep§;
   import §_-52§.§_-EU§;
   import §_-52§.§_-KB§;
   import §_-JM§.§_-3§;
   import §_-Oq§.§_-Bn§;
   import §_-Oq§.§_-De§;
   import com.qzone.qui.controls.Button;
   import com.qzone.qui.controls.Label;
   import com.qzone.qui.controls.RadioButton;
   import common.CommonData;
   import common.Session;
   import common.Settings;
   import common.§_-4Y§;
   import common.§_-Ac§;
   import common.misc.QzoneJSAPI;
   import common.misc.Utils;
   import common.view.MaterialProxyBig;
   import common.view.window.§_-KR§;
   import common.view.window.§_-Ok§;
   import flash.display.Sprite;
   import flash.events.Event;
   import flash.events.MouseEvent;
   import flash.events.TextEvent;
   import flash.external.ExternalInterface;
   import flash.net.URLRequest;
   import flash.net.navigateToURL;
   import flash.text.TextField;
   import flash.text.TextFormat;
   import flash.text.TextFormatAlign;
   import framework.net.NetHelper;
   import framework.net.§_-99§;
   import framework.net.vo.§_-P9§;
   import module.shop.§_-Ln§;

   public class BuyItemWindow extends §_-KR§
   {

      private var _cftButton:Button;

      private var _material:MaterialProxyBig;

      private var §_-Nj§:TextField;

      private var §_-D4§:RadioButton;

      private var _confirmButton:Button;

      private var _cancelButton:Button;

      private var _dogTipText:TextField;

      private var rbtnBuy1:RadioButton;

      private var rbtnBuy2:RadioButton;

      private var rbtnBuy3:RadioButton;

      private var §_-B8§:Sprite;

      private var rbtnQB:RadioButton;

      private var §_-CQ§:§_-KB§;

      private var linkText:TextField;

      private var _parent:§_-Ln§;

      private var _directionText:TextField;

      private var radioGroupDog:§_-KB§;

      private var _errorText:TextField;

      private var §_-8A§:RadioButton;

      private var textDefaultFormat:TextFormat;

      private var _numbericStepper:§_-EU§;

      private var §_-a5§:Label;

      private var §_-OM§:Object;

      public function BuyItemWindow(param1:§_-Ln§)
      {
         super(param1.§_-R9§.module.app as §_-3§);
         width = 400;
         height = 320;
         title = §_-4Y§.§_-Kf§["shopToolWindow"];
         windowName = §_-Ac§.§_-CU§;
         mode = true;
         this._parent = param1;
      }

      private function §_-Ex§(param1:int) : void
      {
         var _loc4_:int = 0;
         var _loc5_:Number = NaN;
         var _loc2_:Item = super.data as Item;
         if(_loc2_ == null)
         {
            return;
         }
         var _loc3_:Player = Session.getInstance().host;
         if(_loc3_ != null)
         {
            _loc5_ = _loc3_._money;
            _loc4_ = _loc3_._fb;
         }
         if(_loc2_._price != 0)
         {
            if(_loc5_ < _loc2_._price * param1)
            {
               this._confirmButton.enabled = false;
               this._errorText.text = §_-4Y§.§_-Kf§["对不起，您的金币不足。"];
            }
            else
            {
               this._confirmButton.enabled = true;
               this._errorText.text = "";
            }
         }
         else if(_loc4_ > 0)
         {
            if(_loc4_ < _loc2_._fb * param1)
            {
               this._confirmButton.enabled = false;
               this._errorText.text = §_-4Y§.§_-Kf§["您的元宝不足。"];
            }
            else
            {
               this._confirmButton.enabled = true;
               this._errorText.text = "";
            }
         }
      }

      override protected function setSize() : void
      {
         super.setSize();
         var _loc1_:Item = super.data as Item;
         if(_loc1_ == null)
         {
            return;
         }
         if(panelTitle != null)
         {
            panelTitle.x = §_-De§.middle(width,panelTitle.width);
         }
      }

      private function onOKCFT(param1:MouseEvent) : void
      {
         if(this._cftButton.enabled == false)
         {
            return;
         }
         var _loc2_:Item = super.data as Item;
         if(_loc2_ == null)
         {
            return;
         }
         var _loc3_:int = this._numbericStepper.value;
         var _loc4_:int = _loc2_._id;
         var _loc5_:int = _loc2_._type;
         if(_loc5_.toString() == §_-Ac§.§_-Zl§)
         {
            _loc5_ = 4;
         }
         var _loc6_:int = 3;
         if(_loc5_ == 4 || _loc5_ == 10 || _loc5_ == 24)
         {
            _loc6_ = _loc5_;
         }
         var _loc7_:int = _loc5_ == 4 ? int(parseInt(§_-Ac§.§_-Zl§)) : _loc5_;
         if(_loc7_ == parseInt(§_-Ac§.§_-Zl§) && _loc4_ < 9000)
         {
            _loc6_ = 7;
            _loc7_ = 4;
         }
         NetHelper.sendRequest(§_-99§.§_-OP§,{
            "shopType":_loc6_,
            "itemType":_loc7_,
            "itemId":_loc4_,
            "itemNum":_loc3_
         },this.§_-0d§,this.onPreCheckedError);
         super.close();
      }

      private function onNumChanged(param1:Event) : void
      {
         var _loc2_:int = this._numbericStepper.value;
         this.§_-Ex§(_loc2_);
         if(this.§_-OM§ != null && this.§_-OM§.toolDetail != undefined)
         {
            this.§_-OM§.toolDetail.htmlText = this.§_-Ws§();
         }
      }

      private function onPreCheckedError(param1:§_-Ep§) : void
      {
         var _loc2_:§_-P9§ = param1.result as §_-P9§;
         if(_loc2_ == null)
         {
            return;
         }
         var _loc3_:Object = _loc2_.m_extra;
         if(_loc3_ == null)
         {
            return;
         }
         if(_loc3_.hasOwnProperty("direction") == true)
         {
            this._parent.§_-R9§.openWindow(§_-Ac§.§_-3r§,{
               "type":§_-Ac§.§_-MP§,
               "text":_loc3_["direction"]
            });
         }
      }

      private function getTextDisabledFormat() : TextFormat
      {
         if(!this.textDefaultFormat)
         {
            this.textDefaultFormat = new TextFormat("Verdana",12,8947848,null,null,null,null,null,"left");
         }
         return this.textDefaultFormat;
      }

      private function §_-LU§(param1:§_-Ep§) : void
      {
         var _loc4_:Item = null;
         var _loc2_:§_-P9§ = param1.result as §_-P9§;
         if(_loc2_ == null)
         {
            return;
         }
         var _loc3_:Object = _loc2_.m_extra;
         if(_loc3_ == null)
         {
            return;
         }
         if(_loc3_["code"] == "1")
         {
            _loc4_ = super.data as Item;
            this._parent.§_-R9§.model.buyInGame(param1.body["__body"],1,"Item",0,_loc4_._type.toString());
            return;
         }
      }

      private function setRaidoStyle(param1:RadioButton) : void
      {
         param1.textDefaultFormat = this.getTextDefaultFormat();
         param1.textDisabledFormat = this.getTextDisabledFormat();
         param1.textSelectedFormat = this.getTextDefaultFormat();
      }

      override protected function setData() : void
      {
         var _loc4_:int = 0;
         var _loc5_:String = null;
         var _loc6_:Number = NaN;
         var _loc7_:Number = NaN;
         var _loc8_:Number = NaN;
         var _loc9_:Player = null;
         height = 320;
         this._confirmButton.y = height - 55;
         this._cancelButton.y = height - 55;
         this.§_-a5§.y = height - this.§_-a5§.height - 4;
         if(super.§_-3f§ == false)
         {
            return;
         }
         var _loc1_:Item = super.data as Item;
         if(_loc1_ == null)
         {
            return;
         }
         this.graphics.clear();
         if(_loc1_.§_-9C§)
         {
            title = "来自藏獒的一封信";
            this._dogTipText.htmlText = "续费有效期：";
            this.§_-OM§.toolName.visible = false;
            this.§_-OM§.toolDetail.y = 10;
            this.§_-OM§.toolDetail.width = 220;
         }
         else
         {
            title = §_-4Y§.§_-Kf§["shopToolWindow"];
            this._dogTipText.htmlText = "领养有效期：";
            this.§_-OM§.toolName.visible = true;
            this.§_-OM§.toolDetail.y = 40;
            this.§_-OM§.toolDetail.width = 240;
         }
         var _loc2_:int = 1;
         if(this._numbericStepper != null)
         {
            this._numbericStepper.value = _loc2_;
         }
         var _loc3_:String = _loc1_._type.toString();
         if(this._material != null)
         {
            this._material.setContent(_loc3_,_loc1_._id);
         }
         if(this.§_-OM§ != null)
         {
            _loc4_ = _loc1_._name.length > 8 ? 22 : 26;
            (this.§_-OM§.toolName as TextField).defaultTextFormat = new TextFormat("Verdana",_loc4_,3381555,true);
            this.§_-OM§.toolName.text = _loc1_._name;
            if(_loc3_ == §_-Ac§.§_-Ux§ || _loc3_ == §_-Ac§.§_-GM§ || _loc3_ == §_-Ac§.§_-2K§)
            {
               if(this._directionText != null)
               {
                  this._directionText.visible = true;
               }
               if(this.§_-B8§ != null)
               {
                  this.§_-B8§.visible = true;
               }
            }
            else if(_loc3_ == §_-Ac§.§_-Zl§)
            {
               if(this.§_-B8§ != null)
               {
                  this.§_-B8§.visible = true;
               }
               if(this._directionText != null)
               {
                  this._directionText.visible = true;
               }
            }
            else
            {
               if(this._directionText != null)
               {
                  this._directionText.visible = false;
               }
               if(this.§_-B8§ != null)
               {
                  this.§_-B8§.visible = false;
               }
            }
            if(this.§_-OM§.toolDetail != undefined)
            {
               this.§_-OM§.toolDetail.htmlText = this.§_-Ws§();
            }
         }
         this._errorText.htmlText = "";
         this._confirmButton.enabled = true;
         this.§_-Ex§(_loc2_);
         if(_loc3_ == §_-Ac§.§_-Ux§ && _loc1_._saleOut == true)
         {
            if(this._errorText != null)
            {
               this._errorText.htmlText = "";
            }
            this._confirmButton.enabled = false;
         }
         else if(_loc3_ == §_-Ac§.§_-Zl§ && _loc1_._saleOut == true)
         {
            if(this._errorText != null)
            {
               this._errorText.htmlText = "";
            }
            this._confirmButton.enabled = false;
         }
         if(_loc1_._fb != 0 && !_loc1_._isQDDog)
         {
            this._confirmButton.text = "用元宝购买";
            this._confirmButton.width = 85;
            if(_loc3_ == §_-Ac§.§_-GM§)
            {
               this._confirmButton.x = width / 2 - this._confirmButton.width - 10;
               this._cancelButton.x = width / 2 + 10;
               if(this._cftButton.parent != null)
               {
                  this._cftButton.parent.removeChild(this._cftButton);
               }
            }
            else
            {
               this._confirmButton.x = width / 2 - this._confirmButton.width - 65;
               this._cancelButton.x = width / 2 + this._cancelButton.width;
               if(this._cftButton.parent == null)
               {
                  addChild(this._cftButton);
               }
            }
         }
         else
         {
            this._confirmButton.text = §_-4Y§.§_-Kf§["确定"];
            this._confirmButton.width = 64;
            this._confirmButton.x = width / 2 - this._confirmButton.width - 10;
            this._cancelButton.x = width / 2 + 10;
            if(this._cftButton.parent != null)
            {
               this._cftButton.parent.removeChild(this._cftButton);
            }
         }
         if(_loc1_._type == 4 && _loc1_._id == 16)
         {
            _loc5_ = Settings.getInstance().getHouseKeeper("0","end");
            _loc6_ = new Date(_loc5_).time;
            _loc7_ = CommonData.serverTime * 1000;
            _loc8_ = _loc6_ + 15 * 24 * 60 * 60 * 1000;
            if(_loc7_ > _loc6_ && _loc7_ <= _loc8_)
            {
               this.§_-OM§.toolDetail.htmlText = "说　明：" + _loc1_._desc + "<br />";
               this._confirmButton.text = "免费领取";
            }
         }
         if(_loc1_._id <= 3 && _loc3_ == §_-Ac§.§_-Ux§ || _loc1_._id == 9001)
         {
            this.§_-a5§.visible = true;
         }
         else
         {
            this.§_-a5§.visible = false;
         }
         §_-Bn§.removeChild(this,this.§_-D4§);
         §_-Bn§.removeChild(this,this.rbtnQB);
         §_-Bn§.removeChild(this,this.§_-8A§);
         §_-Bn§.removeChild(this,this.linkText);
         this.§_-CQ§ = new §_-KB§();
         if(_loc1_._vip == 1 && _loc1_._price == 0 && _loc3_ == §_-Ac§.§_-Ux§)
         {
            this.§_-D4§.selected = false;
            this.rbtnQB.selected = false;
            this.§_-8A§.selected = false;
            this.§_-CQ§.addTarget(this.§_-D4§);
            this.§_-CQ§.addTarget(this.rbtnQB);
            this.§_-CQ§.addTarget(this.§_-8A§);
            addChild(this.§_-D4§);
            addChild(this.rbtnQB);
            addChild(this.§_-8A§);
            addChild(this.linkText);
            _loc9_ = Session.getInstance().host;
            if(_loc9_._yellowstatus != 2)
            {
               this.§_-D4§.enabled = false;
               this.rbtnQB.selected = true;
               this.§_-CQ§.selectedTarget = this.rbtnQB;
            }
            else
            {
               this.§_-D4§.enabled = true;
               this.§_-D4§.selected = true;
               this.§_-CQ§.selectedTarget = this.§_-D4§;
            }
            this._confirmButton.text = §_-4Y§.§_-Kf§["确定"];
            this._confirmButton.width = 64;
            this._confirmButton.x = width / 2 - this._confirmButton.width - 10;
            this._cancelButton.x = width / 2 + 10;
            §_-Bn§.removeChild(this,this._cftButton);
            height = 360;
            this._confirmButton.y = height - 55;
            this._cancelButton.y = height - 55;
            this.§_-a5§.y = height - this.§_-a5§.height - 4;
         }
         if(_loc1_._shortage == true)
         {
            if(this._errorText != null)
            {
               this._errorText.htmlText = "";
            }
            this._confirmButton.enabled = false;
            this._cftButton.enabled = false;
         }
         §_-Bn§.removeChild(this,this.rbtnBuy1);
         §_-Bn§.removeChild(this,this.rbtnBuy2);
         §_-Bn§.removeChild(this,this.rbtnBuy3);
         if(_loc1_._isQDDog)
         {
            this.rbtnBuy1.selected = false;
            this.rbtnBuy2.selected = false;
            this.rbtnBuy3.selected = true;
            addChild(this.rbtnBuy1);
            addChild(this.rbtnBuy2);
            addChild(this.rbtnBuy3);
            this.radioGroupDog.selectedTarget = this.rbtnBuy3;
            this._confirmButton.text = §_-4Y§.§_-Kf§["确定"];
            this._confirmButton.width = 64;
            this._confirmButton.x = width / 2 - this._confirmButton.width - 10;
            this._cancelButton.x = width / 2 + 10;
            §_-Bn§.removeChild(this,this._cftButton);
            height = 330;
            this._confirmButton.y = height - 55;
            this._cancelButton.y = height - 55;
            this.§_-Nj§.visible = true;
            this.§_-Nj§.htmlText = this.buildDogPriceText();
            this._dogTipText.visible = true;
         }
         else
         {
            this.§_-Nj§.visible = false;
            this.§_-Nj§.htmlText = "";
            this._dogTipText.visible = false;
         }
      }

      private function §_-0d§(param1:§_-Ep§) : void
      {
         var _loc4_:Item = null;
         var _loc2_:§_-P9§ = param1.result as §_-P9§;
         if(_loc2_ == null)
         {
            return;
         }
         var _loc3_:Object = _loc2_.m_extra;
         if(_loc3_ == null)
         {
            return;
         }
         if(_loc3_["code"] == "1")
         {
            _loc4_ = super.data as Item;
            this._parent.§_-R9§.model.buyInGame(param1.body["__body"],2,"Item",0,_loc4_._type.toString());
         }
      }

      private function onRadioBtnChanged(param1:Event) : void
      {
         this.§_-Nj§.htmlText = this.buildDogPriceText();
      }

      private function §_-Ws§() : String
      {
         var _loc1_:String = "";
         var _loc2_:Item = super.data as Item;
         if(_loc2_ == null)
         {
            return _loc1_;
         }
         var _loc3_:String = _loc2_._type.toString();
         var _loc4_:int = 0;
         if(_loc2_.§_-9C§)
         {
            return "亲爱的主人：<br>我的工作时间仅剩<font color = \'#FF0000\'size = \'18\'> " + _loc2_._timeLimit.toString() + " </font>天，快为我续费吧，续费后我将能继续为您抓好多好多坏人，打跑好多好多野生动物，赚好多好多金币！<br><p align=\'right\'>藏獒</p>";
         }
         if(this._numbericStepper != null && !_loc2_._isQDDog)
         {
            _loc4_ = this._numbericStepper.value;
            if(_loc2_._price != 0)
            {
               _loc1_ += "金币价：<font size=\"11\" color=\"#FF6600\"><b>" + _loc2_._price * _loc4_ + "</b></font> <font color=\"#CC3300\">金币</font><br>";
            }
            else
            {
               _loc1_ += "<textformat indent=\"2\">元宝价</textformat>：普通 <font size=\"11\" color=\"#0099FF\"><b>" + _loc2_._fb * _loc4_ + "</b></font> <font color=\"#003366\">元宝</font><br>";
               _loc1_ += "特惠价：VIP <font size=\"11\" color=\"#FF6600\"><b>" + _loc2_._yfb * _loc4_ + "</b></font> <font color=\"#003366\">元宝</font> (节省 <font size=\"11\" color=\"#FF6600\"><b>";
               _loc1_ += _loc2_._fb * _loc4_ - _loc2_._yfb * _loc4_ + "</b></font> <font color=\"#003366\">元宝</font>)<br />";
               _loc1_ += "<p align=\"right\"><font size=\"12\" color=\"#666666\"></font></p>";
            }
         }
         if(_loc3_ == §_-Ac§.§_-Ux§)
         {
            _loc1_ += "类　型：化肥<br />";
            if(_loc2_._id == 6 || _loc2_._id == 5)
            {
               _loc1_ += "道具类型：特殊道具<br />";
            }
         }
         else if(_loc3_ == §_-Ac§.§_-Zl§)
         {
            _loc1_ += "类　型：狗粮<br />";
         }
         else if(_loc3_ == §_-Ac§.§_-9D§)
         {
            if(_loc2_._isQDDog == true)
            {
               _loc1_ += "类　型：特供狗<br />";
            }
            else
            {
               _loc1_ += "类　型：狗<br />";
            }
            if(_loc2_._id <= 4)
            {
               _loc1_ += "<font size=\"12\" color=\"#BF7746\">购买此狗，即可获赠价值4元宝狗粮。</font><br />";
            }
         }
         else if(_loc3_ == §_-Ac§.§_-2K§)
         {
            _loc1_ += "类　型：鱼食<br />";
         }
         return _loc1_ + ("说　明：" + _loc2_._desc + "<br />");
      }

      private function onOKGoldConfirm(param1:MouseEvent) : void
      {
         var _loc3_:int = 0;
         if(this._confirmButton.enabled == false)
         {
            return;
         }
         var _loc2_:Item = super.data as Item;
         if(_loc2_ == null)
         {
            return;
         }
         if(_loc2_._vip == 1 && _loc2_._price == 0 && _loc2_._type.toString() == §_-Ac§.§_-Ux§)
         {
            if(this.§_-CQ§.selectedTarget == this.rbtnQB)
            {
               this.onOKGold(null);
            }
            else if(this.§_-CQ§.selectedTarget == this.§_-8A§)
            {
               this.onOKCFT(null);
            }
            else if(this.§_-CQ§.selectedTarget == this.§_-D4§)
            {
               _loc3_ = this._numbericStepper.value;
               this._parent.§_-R9§.model.§_-KF§(_loc2_._id,_loc3_);
               super.onClose(param1);
            }
         }
         else if(_loc2_._type == 4 && _loc2_._id == 16)
         {
            navigateToURL(new URLRequest(Settings.getInstance().getHouseKeeper("0","shopdog")),"_blank");
            super.close();
         }
         else
         {
            this.onOKGold(null);
         }
      }

      private function buildDogPriceText() : String
      {
         var _loc1_:String = "";
         var _loc2_:Item = super.data as Item;
         if(_loc2_ == null || _loc2_._isQDDog == false)
         {
            return _loc1_;
         }
         var _loc3_:int = 0;
         var _loc4_:int = 0;
         if(this.radioGroupDog.selectedTarget == this.rbtnBuy1)
         {
            _loc3_ = _loc2_._buy_1;
            _loc4_ = _loc2_._Ybuy_1;
         }
         else if(this.radioGroupDog.selectedTarget == this.rbtnBuy2)
         {
            _loc3_ = _loc2_._buy_6;
            _loc4_ = _loc2_._Ybuy_6;
         }
         else if(this.radioGroupDog.selectedTarget == this.rbtnBuy3)
         {
            _loc3_ = _loc2_._buy_12;
            _loc4_ = _loc2_._Ybuy_12;
         }
         _loc1_ += "<textformat indent=\"2\">元宝价</textformat>：普通 <font size=\"11\" color=\"#0099FF\"><b>" + _loc3_.toString() + "</b></font> <font color=\"#003366\">元宝</font><br>";
         return _loc1_ + ("特惠价：VIP <font size=\"11\" color=\"#FF6600\"><b>" + _loc4_.toString() + "</b></font> <font color=\"#003366\">元宝</font>");
      }

      private function onLinkUpgradeClicked(param1:TextEvent) : void
      {
      }

      private function getTextDefaultFormat() : TextFormat
      {
         if(!this.textDefaultFormat)
         {
            this.textDefaultFormat = new TextFormat("Verdana",12,0,null,null,null,null,null,"left");
         }
         return this.textDefaultFormat;
      }

      private function onNavigateToURL(param1:TextEvent) : void
      {
         var _loc2_:String = param1.text;
         if(_loc2_ == "" || ExternalInterface.available == false)
         {
            return;
         }
         ExternalInterface.call("window.open",_loc2_);
      }

      override protected function addedToLayer() : void
      {
         super.addedToLayer();
         this._material = new MaterialProxyBig();
         this._material.x = 20;
         this._material.y = 50;
         addChild(this._material);
         this._numbericStepper = new §_-EU§();
         this._numbericStepper.maximum = 99;
         this._numbericStepper.minimum = 1;
         this._numbericStepper.value = 1;
         this._numbericStepper.addEventListener(Event.CHANGE,this.onNumChanged);
         this.§_-B8§ = new SteperSkin();
         this.§_-B8§.x = 30;
         this.§_-B8§.y = 182;
         this._numbericStepper.setSkin(this.§_-B8§);
         addChild(this.§_-B8§);
         this.§_-OM§ = Utils.getMaterial("ShopToolForm");
         this.§_-OM§.x = 190;
         this.§_-OM§.y = 40;
         addChild(this.§_-OM§ as Sprite);
         this._errorText = new TextField();
         this._errorText.mouseEnabled = true;
         this._errorText.selectable = false;
         this._errorText.x = 0;
         this._errorText.y = this.height - 80;
         this._errorText.width = 400;
         this._errorText.height = 21;
         this._errorText.defaultTextFormat = new TextFormat("Verdana",12,13369344,null,null,null,null,null,TextFormatAlign.CENTER);
         this._errorText.text = "";
         this._errorText.addEventListener(TextEvent.LINK,this.onNavigateToURL);
         addChild(this._errorText);
         this._directionText = new TextField();
         this._directionText.selectable = false;
         this._directionText.x = 20;
         this._directionText.y = 210;
         this._directionText.width = 150;
         this._directionText.height = 22;
         this._directionText.defaultTextFormat = new TextFormat("Verdana",12,6710886);
         this._directionText.text = §_-4Y§.replaceText("buyNum",{
            "minNum":1,
            "maxNum":99
         });
         addChild(this._directionText);
         this._confirmButton = new Button();
         this._confirmButton.defaultSkin = Utils.getClass("ButtonOrange");
         this._confirmButton.width = 64;
         this._confirmButton.height = 25;
         this._confirmButton.text = §_-4Y§.§_-Kf§["确定"];
         this._confirmButton.x = width / 2 - this._confirmButton.width - 10;
         this._confirmButton.y = height - 55;
         this._confirmButton.addEventListener(MouseEvent.CLICK,this.onOKGoldConfirm);
         addChild(this._confirmButton);
         this._cftButton = new Button();
         this._cftButton.defaultSkin = Utils.getClass("ButtonOrange");
         this._cftButton.width = 95;
         this._cftButton.height = 25;
         this._cftButton.x = (width - this._cftButton.width) / 2;
         this._cftButton.y = height - 55;
         this._cftButton.text = "暂时无用";
         this._cftButton.addEventListener(MouseEvent.CLICK,this.onOKCFT);
         this._cancelButton = new Button();
         this._cancelButton.defaultSkin = Utils.getClass("ButtonBlue");
         this._cancelButton.width = 64;
         this._cancelButton.height = 25;
         this._cancelButton.x = width / 2 + 10;
         this._cancelButton.y = height - 55;
         this._cancelButton.text = §_-4Y§.§_-Kf§["取消"];
         this._cancelButton.addEventListener(MouseEvent.CLICK,super.onClose);
         addChild(this._cancelButton);
         var _loc1_:String = "";
         this.§_-a5§ = new Label(_loc1_);
         this.§_-a5§.addEventListener(TextEvent.LINK,this.onNavigateToURL);
         this.§_-a5§.width = width - 3;
         this.§_-a5§.x = 1;
         this.§_-a5§.y = height - this.§_-a5§.height - 4;
         this.§_-a5§.mouseChildren = true;
         §_-Ok§.addTarget(this.§_-a5§);
         var _loc2_:TextFormat = new TextFormat("Verdana",null,null,null,null,null,null,null,"center");
         this.§_-a5§.textDefaultFormat = _loc2_;
         addChild(this.§_-a5§);
         this.§_-D4§ = new RadioButton("年费VIP免费使用");
         this.setRaidoStyle(this.§_-D4§);
         this.§_-D4§.x = 68;
         this.§_-D4§.y = this._directionText.y + this._directionText.height + 10;
         this.rbtnQB = new RadioButton("元宝买");
         this.setRaidoStyle(this.rbtnQB);
         this.rbtnQB.x = 68;
         this.rbtnQB.y = this.§_-D4§.y + 25;
         this.§_-8A§ = new RadioButton("暂时无用");
         this.setRaidoStyle(this.§_-8A§);
         this.§_-8A§.x = 148;
         this.§_-8A§.y = this.§_-D4§.y + 25;
         this.linkText = new TextField();
         this.linkText.multiline = false;
         this.linkText.height = 20;
         this.linkText.htmlText = "<font size=\"12\" color=\"#CC0000\">已启用 VIP 权益</font>";
         this.linkText.x = this.§_-D4§.x + this.§_-D4§.width + 30;
         this.linkText.y = this.§_-D4§.y;
         addChild(this.linkText);
         this.§_-Nj§ = new TextField();
         this.§_-Nj§.selectable = false;
         this.§_-Nj§.x = 10;
         this.§_-Nj§.y = 176;
         this.§_-Nj§.width = 150;
         this.§_-Nj§.height = 40;
         this.§_-Nj§.defaultTextFormat = new TextFormat("Verdana",12);
         this.§_-Nj§.multiline = true;
         addChild(this.§_-Nj§);
         this.§_-Nj§.visible = false;
         this._dogTipText = new TextField();
         this._dogTipText.multiline = false;
         this._dogTipText.height = 20;
         this._dogTipText.htmlText = "领养有效期：";
         this._dogTipText.x = 48;
         this._dogTipText.y = this._directionText.y + this._directionText.height;
         addChild(this._dogTipText);
         this._dogTipText.visible = false;
         this.rbtnBuy1 = new RadioButton("1个月");
         this.setRaidoStyle(this.rbtnBuy1);
         this.rbtnBuy1.x = this._dogTipText.x + 75;
         this.rbtnBuy1.y = this._dogTipText.y;
         this.rbtnBuy2 = new RadioButton("6个月");
         this.setRaidoStyle(this.rbtnBuy2);
         this.rbtnBuy2.x = this.rbtnBuy1.x + 60;
         this.rbtnBuy2.y = this.rbtnBuy1.y;
         this.rbtnBuy3 = new RadioButton("12个月");
         this.setRaidoStyle(this.rbtnBuy3);
         this.rbtnBuy3.x = this.rbtnBuy1.x + 120;
         this.rbtnBuy3.y = this.rbtnBuy1.y;
         this.radioGroupDog = new §_-KB§();
         this.radioGroupDog.addTarget(this.rbtnBuy1);
         this.radioGroupDog.addTarget(this.rbtnBuy2);
         this.radioGroupDog.addTarget(this.rbtnBuy3);
         this.radioGroupDog.addEventListener(Event.CHANGE,this.onRadioBtnChanged);
      }

      private function onOKGold(param1:MouseEvent) : void
      {
         var _loc8_:int = 0;
         var _loc9_:int = 0;
         if(this._confirmButton.enabled == false)
         {
            return;
         }
         var _loc2_:Player = Session.getInstance().host;
         var _loc3_:Item = super.data as Item;
         if(_loc3_ == null)
         {
            return;
         }
         var _loc4_:Boolean = false;
         if(_loc3_._price == 0)
         {
            _loc4_ = true;
         }
         var _loc5_:int = _loc3_._type;
         var _loc6_:int = this._numbericStepper.value;
         if(_loc3_._isQDDog)
         {
            if(this.radioGroupDog.selectedTarget == this.rbtnBuy1)
            {
               _loc6_ = 1;
            }
            else if(this.radioGroupDog.selectedTarget == this.rbtnBuy2)
            {
               _loc6_ = 6;
            }
            else if(this.radioGroupDog.selectedTarget == this.rbtnBuy3)
            {
               _loc6_ = 12;
            }
         }
         if(!_loc4_ && _loc5_.toString() == §_-Ac§.§_-GM§)
         {
            this._parent.§_-R9§.model.buyWeapon(_loc3_._id,_loc6_,_loc5_);
            super.onClose(param1);
            return;
         }
         if(_loc5_.toString() == §_-Ac§.§_-Zl§)
         {
            _loc5_ = 4;
         }
         var _loc7_:int = _loc2_._yellowstatus >= 1 ? _loc3_._yfb : _loc3_._fb;
         if(_loc4_ == false)
         {
            this._parent.§_-R9§.model.§_-Zb§(_loc3_._id,_loc6_,_loc5_,_loc4_,_loc3_._name,_loc7_);
         }
         else
         {
            _loc8_ = 3;
            if(_loc5_ == 4 || _loc5_ == 10 || _loc5_ == 24)
            {
               _loc8_ = _loc5_;
            }
            _loc9_ = _loc5_ == 4 ? int(parseInt(§_-Ac§.§_-Zl§)) : _loc5_;
            if(_loc9_ == parseInt(§_-Ac§.§_-Zl§) && _loc3_._id < 9000)
            {
               _loc8_ = 7;
               _loc9_ = 4;
            }
            NetHelper.sendRequest(§_-99§.§_-OP§,{
               "shopType":_loc8_,
               "itemType":_loc9_,
               "itemId":_loc3_._id,
               "itemNum":_loc6_
            },this.§_-LU§,this.onPreCheckedError);
         }
         super.onClose(param1);
      }
   }
}
