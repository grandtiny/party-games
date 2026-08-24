package §_-W§
{
   import §_-0H§.DIYDecor;
   import §_-0H§.Player;
   import §_-3i§.§_-Ep§;
   import §_-52§.§_-KB§;
   import §_-Iw§.§_-Yj§;
   import §_-JM§.§_-3§;
   import §_-Oq§.§_-De§;
   import com.qzone.qui.controls.Button;
   import com.qzone.qui.controls.Label;
   import com.qzone.qui.controls.RadioButton;
   import common.Session;
   import common.Settings;
   import common.§_-4Y§;
   import common.§_-Ac§;
   import common.misc.QzoneJSAPI;
   import common.misc.Utils;
   import common.view.MaterialProxy;
   import common.view.window.AddButtonWindow;
   import common.view.window.§_-Ok§;
   import flash.display.Sprite;
   import flash.events.Event;
   import flash.events.MouseEvent;
   import flash.events.TextEvent;
   import flash.text.TextField;
   import flash.text.TextFormat;
   import flash.text.TextFormatAlign;
   import framework.net.NetHelper;
   import framework.net.§_-99§;
   import framework.net.vo.§_-P9§;
   import module.shop.§_-Ln§;

   public class BuyDiyWindow extends AddButtonWindow
   {

      private var §_-76§:Object;

      private var §_-CQ§:§_-KB§;

      private var linkText:TextField;

      private var _parent:§_-Ln§;

      private var §_-TK§:RadioButton;

      private var _material:MaterialProxy;

      private var _directionText:TextField;

      private var §_-62§:RadioButton;

      private var §_-2g§:Object;

      private var §_-8A§:RadioButton;

      private var §_-Fz§:Button;

      private var textDefaultFormat:TextFormat;

      private var §_-a5§:Label;

      private var rbtnQB:RadioButton;

      public function BuyDiyWindow(param1:§_-Ln§)
      {
         super(param1.§_-R9§.module.app as §_-3§);
         width = 430;
         height = 340;
         title = §_-4Y§.§_-Kf§["购买装饰"];
         windowName = §_-Ac§.WINDOW_NAME_BUYDIY;
         mode = true;
         this.§_-2g§ = null;
         this._directionText = null;
         this._material = null;
         this._parent = param1;
         this.§_-76§ = null;
         this.§_-Fz§ = null;
      }

      private function §_-3M§() : void
      {
         var _loc6_:Sprite = null;
         var _loc7_:Sprite = null;
         removeAllButton();
         var _loc1_:String = Settings.getInstance().getDynamicTip("shopVipDIYTip") || "稀有装扮限时购买";
         this.§_-a5§ = new Label(_loc1_);
         this.§_-a5§.width = width - 5;
         this.§_-a5§.x = 1;
         this.§_-a5§.y = 27;
         this.§_-a5§.mouseChildren = true;
         §_-Ok§.addTarget(this.§_-a5§);
         var _loc2_:TextFormat = new TextFormat("Verdana",null,null,null,null,null,null,null,"center");
         this.§_-a5§.textDefaultFormat = _loc2_;
         addChild(this.§_-a5§);
         var _loc3_:Button = new Button();
         _loc3_.defaultSkin = Utils.getClass("ButtonBlue");
         _loc3_.text = "预览";
         _loc3_.width = 60;
         _loc3_.height = 25;
         _loc3_.x = 50;
         _loc3_.y = 182;
         this.addChild(_loc3_);
         _loc3_.addEventListener(MouseEvent.CLICK,this.onPreview);
         this.§_-2g§ = Utils.getMaterial("ShopDiyForm") as Object;
         if(this.§_-2g§ != null)
         {
            this.§_-2g§.x = 190;
            this.§_-2g§.y = 40;
            addChild(this.§_-2g§ as Sprite);
         }
         this._directionText = new TextField();
         this._directionText.defaultTextFormat = new TextFormat("Verdana",12,13369344,false,null,null,null,null,TextFormatAlign.CENTER);
         this._directionText.width = 400;
         this._directionText.height = 21;
         this._directionText.x = 0;
         this._directionText.y = this.height - 65;
         this._directionText.selectable = false;
         §_-K2§(this._directionText);
         var _loc4_:Class = Utils.getClass("ItemBorder");
         if(_loc4_ != null)
         {
            _loc6_ = new _loc4_() as Sprite;
            _loc7_ = new _loc4_() as Sprite;
            _loc7_.width = _loc6_.width = 120;
            _loc7_.height = _loc6_.height = 120;
            this._material = new MaterialProxy(MaterialProxy.§_-4O§);
            this._material.x = _loc7_.x = _loc6_.x = 20;
            this._material.y = _loc7_.y = _loc6_.y = 50;
            this._material.mask = _loc6_;
            §_-K2§(this._material);
            §_-K2§(_loc6_);
            §_-K2§(_loc7_);
         }
         this.§_-Fz§ = addButton(§_-4Y§.§_-Kf§["确定"],"ButtonOrange",60,25,this.onOK);
         addButton(§_-4Y§.§_-Kf§["取消"],"ButtonBlue",60,25,super.close);
         var _loc5_:int = 4;
         this.§_-TK§ = new RadioButton("VIP LV" + _loc5_ + "及以上免费装扮（无期限，不获得经验值）");
         this.setRaidoStyle(this.§_-TK§);
         this.§_-TK§.x = 68;
         this.§_-TK§.y = this.height - 115;
         this.§_-62§ = new RadioButton("金币买");
         this.setRaidoStyle(this.§_-62§);
         this.§_-62§.x = 68;
         this.§_-62§.y = this.height - 90;
         this.rbtnQB = new RadioButton("元宝买");
         this.setRaidoStyle(this.rbtnQB);
         this.rbtnQB.x = 148;
         this.rbtnQB.y = this.height - 90;
         this.§_-8A§ = new RadioButton("暂时无用");
         this.setRaidoStyle(this.§_-8A§);
         this.§_-8A§.x = 228;
         this.§_-8A§.y = this.height - 90;
      }

      private function onOK() : void
      {
         if(this.§_-CQ§.selectedTarget == this.§_-TK§)
         {
            this.§_-PL§();
         }
         else if(this.§_-CQ§.selectedTarget == this.§_-62§)
         {
            this.useGoldBuy();
         }
         else if(this.§_-CQ§.selectedTarget == this.rbtnQB)
         {
            this.useQDBuy();
         }
         else if(this.§_-CQ§.selectedTarget == this.§_-8A§)
         {
            this.useCFTBuy();
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
         this.§_-76§ = null;
      }

      private function useCFTBuy() : void
      {
         var _loc1_:DIYDecor = super.data as DIYDecor;
         if(_loc1_ == null)
         {
            return;
         }
         var _loc2_:int = parseInt(§_-Ac§.§_-SJ§);
         var _loc3_:int = _loc1_._type;
         var _loc4_:int = _loc1_._id;
         var _loc5_:int = 1;
         NetHelper.sendRequest(§_-99§.§_-OP§,{
            "shopType":_loc2_,
            "itemType":_loc3_,
            "itemId":_loc4_,
            "itemNum":_loc5_
         },this.§_-0d§,this.onPreCheckedError);
         super.close();
      }

      private function onLinkUpgradeClicked(param1:TextEvent) : void
      {
      }

      private function setRaidoStyle(param1:RadioButton) : void
      {
         param1.textDefaultFormat = this.getTextDefaultFormat();
         param1.textDisabledFormat = this.getTextDisabledFormat();
         param1.textSelectedFormat = this.getTextDefaultFormat();
      }

      private function useQDBuy() : void
      {
         var _loc1_:DIYDecor = super.data as DIYDecor;
         if(_loc1_ == null)
         {
            return;
         }
         var _loc2_:int = 2;
         var _loc3_:int = _loc1_._type;
         NetHelper.sendRequest(§_-99§.§_-OP§,{
            "shopType":_loc2_,
            "itemType":_loc3_,
            "itemId":_loc1_._id,
            "itemNum":1
         },this.§_-LU§,this.onPreCheckedError);
         super.close();
      }

      override protected function setSize() : void
      {
         super.setSize();
         panelTitle.x = §_-De§.middle(_width,panelTitle.width);
      }

      private function yellowLvlDiyFn(param1:§_-Ep§) : void
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
         if(_loc3_["code"] == "1")
         {
            this._parent.§_-R9§.module.app.dispatchEvent(new §_-Yj§(§_-Ac§.§_-WP§,null));
            this._parent.§_-R9§.openWindow(§_-Ac§.§_-3r§,{
               "type":§_-Ac§.§_-6b§,
               "text":"免费装饰成功！"
            });
         }
         else if(_loc3_.hasOwnProperty("direction") == true)
         {
            this._parent.§_-R9§.openWindow(§_-Ac§.§_-3r§,{
               "type":§_-Ac§.§_-MP§,
               "text":_loc3_["direction"]
            });
         }
      }

      private function onPreview(param1:Event) : void
      {
         this._parent.§_-R9§.module.app.dispatchEvent(new §_-Yj§(§_-Ac§.§_-NJ§,super.data));
      }

      override protected function setData() : void
      {
         var _loc3_:TextField = null;
         var _loc4_:int = 0;
         var _loc7_:int = 0;
         var _loc8_:Number = NaN;
         this.graphics.clear();
         if(super.§_-3f§ == false)
         {
            return;
         }
         super.init();
         var _loc1_:Player = Session.getInstance().host;
         if(_loc1_ == null)
         {
            return;
         }
         var _loc2_:DIYDecor = super.data as DIYDecor;
         if(_loc2_ == null)
         {
            return;
         }
         _loc3_ = new TextField();
         _loc3_.text = "请选择：";
         _loc3_.selectable = false;
         _loc3_.x = 20;
         _loc3_.y = this.height - 115;
         _loc3_.width = 50;
         addChild(_loc3_);
         this.§_-CQ§ = new §_-KB§();
         _loc4_ = 4;
         this.§_-CQ§.removeTarget(this.§_-TK§);
         this.§_-CQ§.removeTarget(this.§_-62§);
         this.§_-CQ§.removeTarget(this.rbtnQB);
         this.§_-CQ§.removeTarget(this.§_-8A§);
         this.§_-TK§.selected = false;
         this.§_-62§.selected = false;
         this.rbtnQB.selected = false;
         this.§_-8A§.selected = false;
         if(this.§_-62§.parent == null)
         {
            addChild(this.§_-62§);
         }
         this.§_-CQ§.addTarget(this.§_-62§);
         this.linkText = new TextField();
         this.linkText.htmlText = "";
         this.linkText.x = _loc3_.width + this.§_-TK§.width + 20;
         this.linkText.y = this.height - 115;
         this.linkText.visible = false;
         var _loc5_:Boolean = false;
         var _loc6_:Boolean = false;
         this.§_-TK§.enabled = false;
         if(_loc1_._money < _loc2_._price)
         {
            _loc5_ = true;
            this.§_-62§.enabled = false;
         }
         else
         {
            this.§_-62§.enabled = true;
            this.§_-CQ§.selectedTarget = this.§_-62§;
            this.§_-62§.selected = true;
         }
         if(_loc2_._fb != 0)
         {
            _loc7_ = _loc2_._fb;
            if(_loc1_._yellowstatus >= 1)
            {
               _loc7_ = _loc2_._yfb;
            }
            if(this.rbtnQB.parent == null)
            {
               addChild(this.rbtnQB);
            }
            this.§_-CQ§.addTarget(this.rbtnQB);
            this.§_-CQ§.selectedTarget = this.rbtnQB;
            this.rbtnQB.selected = true;
            _loc8_ = _loc2_._fb * 0.88 * 0.1;
            if(_loc1_._yellowstatus >= 1)
            {
               _loc8_ = _loc2_._yfb * 0.88 * 0.1;
            }
            if(this.§_-8A§.parent == null)
            {
               addChild(this.§_-8A§);
            }
            this.§_-CQ§.addTarget(this.§_-8A§);
            if(!this.§_-TK§.selected && !this.§_-62§.selected && !this.rbtnQB.selected)
            {
               this.§_-CQ§.selectedTarget = this.§_-8A§;
               this.§_-8A§.selected = true;
            }
         }
         else
         {
            if(this.rbtnQB.parent != null)
            {
               this.rbtnQB.parent.removeChild(this.rbtnQB);
            }
            if(this.§_-8A§.parent != null)
            {
               this.§_-8A§.parent.removeChild(this.§_-8A§);
            }
         }
         if(_loc2_._price <= 0)
         {
            this.§_-62§.parent.removeChild(this.§_-62§);
            this.§_-CQ§.removeTarget(this.§_-62§);
            this.§_-TK§.parent.removeChild(this.§_-TK§);
            this.§_-CQ§.removeTarget(this.§_-TK§);
            this.rbtnQB.x = 68;
            this.§_-8A§.x = 148;
            this.§_-8A§.y = this.rbtnQB.y = this.height - 115;
            this.§_-a5§.visible = true;
            this.§_-2g§.y = 48;
         }
         else
         {
            this.rbtnQB.x = 148;
            this.§_-8A§.x = 228;
            this.§_-8A§.y = this.rbtnQB.y = this.height - 90;
            this.§_-a5§.visible = false;
            this.§_-2g§.y = 40;
         }
         if(_loc5_)
         {
            this.§_-Fz§.enabled = false;
         }
         else
         {
            this.§_-Fz§.enabled = true;
         }
         this._directionText.text = "";
         if(_loc5_ && !_loc6_)
         {
            this._directionText.text = §_-4Y§.§_-Kf§["您的金币不足。"];
         }
         else if(!_loc5_ && _loc6_)
         {
            this._directionText.text = §_-4Y§.§_-Kf§["您的元宝不足。"];
         }
         else if(_loc5_ && _loc6_)
         {
            this._directionText.text = §_-4Y§.§_-Kf§["您的元宝和金币都不足。"];
         }
         if(this.§_-2g§ != null)
         {
            (this.§_-2g§.diyName as TextField).defaultTextFormat = new TextFormat("Verdana",26,3381555,true);
            this.§_-2g§.diyName.text = _loc2_._name;
            if(this.§_-2g§.diyDetail != null)
            {
               this.§_-2g§.diyDetail.htmlText = this.§_-Ws§();
            }
         }
         if(this._material != null)
         {
            this._material.setContent("2",_loc2_._id,true);
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

      private function §_-0d§(param1:§_-Ep§) : void
      {
         var _loc4_:DIYDecor = null;
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
            _loc4_ = super.data as DIYDecor;
            this._parent.§_-R9§.model.buyInGame(param1.body["__body"],2,"DIY",_loc4_._exp);
         }
      }

      private function §_-PL§() : void
      {
         var _loc1_:DIYDecor = super.data as DIYDecor;
         var _loc2_:int = _loc1_._id;
         NetHelper.sendRequest(§_-99§.§_-E4§,{"itemId":_loc2_},this.yellowLvlDiyFn,this.onPreCheckedError);
         super.close();
      }

      private function §_-Ws§() : String
      {
         var _loc1_:DIYDecor = super.data as DIYDecor;
         if(_loc1_ == null)
         {
            return "";
         }
         var _loc2_:String = "";
         if(_loc1_._price > 0)
         {
            _loc2_ += "金币价：<font size=\"11\" color=\"#FF6600\"><b>" + _loc1_._price + "</b></font> <font color=\"#CC3300\">金币</font><br>";
         }
         var _loc3_:int = -60;
         if(_loc1_._fb != 0)
         {
            _loc2_ += "<textformat indent=\"2\">元宝价</textformat>：普通 <font size=\"11\" color=\"#0099FF\"><b>" + _loc1_._fb + "</b></font> <font color=\"#003366\">元宝</font><br>";
            _loc2_ += "特惠价：VIP <font size=\"11\" color=\"#FF6600\"><b>" + _loc1_._yfb + "</b></font> <font color=\"#003366\">元宝</font> (节省 <font size=\"11\" color=\"#FF6600\"><b>";
            _loc2_ += _loc1_._fb - _loc1_._yfb + "</b></font> <font color=\"#003366\">元宝</font>)<br />";
            _loc2_ += "<p align=\"right\"><font size=\"12\" color=\"#666666\"></font></p>";
         }
         return _loc2_ + ("有效期：" + _loc1_._validTime / 86400 + " 天，可获得经验值：" + _loc1_._exp + "<br />");
      }

      private function §_-LU§(param1:§_-Ep§) : void
      {
         var _loc4_:DIYDecor = null;
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
            _loc4_ = super.data as DIYDecor;
            this._parent.§_-R9§.model.buyInGame(param1.body["__body"],1,"DIY",_loc4_._exp);
         }
      }

      private function getTextDefaultFormat() : TextFormat
      {
         if(!this.textDefaultFormat)
         {
            this.textDefaultFormat = new TextFormat("Verdana",12,0,null,null,null,null,null,"left");
         }
         return this.textDefaultFormat;
      }

      override protected function addedToLayer() : void
      {
         super.addedToLayer();
         this.§_-3M§();
      }

      private function useGoldBuy() : void
      {
         var _loc1_:DIYDecor = super.data as DIYDecor;
         if(_loc1_ == null)
         {
            return;
         }
         this._parent.§_-R9§.model.§_-TS§(_loc1_._id);
         super.close();
      }
   }
}
