package common.view.window
{
   import §_-0H§.Player;
   import §_-3i§.§_-Ep§;
   import §_-52§.§_-KB§;
   import §_-JM§.§_-3§;
   import com.qzone.qui.controls.Button;
   import com.qzone.qui.controls.RadioButton;
   import com.qzone.qui.controls.TabBar;
   import common.CommonData;
   import common.Session;
   import common.Settings;
   import common.§_-4Y§;
   import common.§_-Ac§;
   import common.misc.Utils;
   import flash.display.DisplayObject;
   import flash.display.MovieClip;
   import flash.display.Shape;
   import flash.display.Sprite;
   import flash.events.Event;
   import flash.events.MouseEvent;
   import flash.events.TimerEvent;
   import flash.text.StyleSheet;
   import flash.text.TextField;
   import flash.text.TextFieldAutoSize;
   import flash.text.TextFormat;
   import flash.text.TextFormatAlign;
   import flash.utils.Timer;
   import framework.net.NetHelper;
   import framework.net.§_-99§;
   import framework.net.vo.§_-P9§;

   public class §_-LI§ extends ConfirmWindow
   {

      private var _cd:int;

      private var §_-Gm§:RadioButton;

      private var §_-Py§:TextFormat;

      private var _redText:String;

      private const §_-JJ§:uint = 445;

      private var _tipText:TextField;

      private var _targetBlack:int;

      private var _tipText2:TextField;

      private var §_-L8§:Boolean;

      private var _tf1:TextFormat;

      private var §_-2T§:Shape;

      private var _tf2:TextFormat;

      private var _timer:Timer;

      private var §_-Zs§:§_-KB§;

      private var _rbtnQB:RadioButton;

      private var §_-2j§:TabBar;

      private var §_-2I§:Boolean;

      private var _checkBlack:Boolean;

      private var _newIcon:MovieClip;

      private var _helpText:TextField;

      public function §_-LI§(param1:§_-3§)
      {
         super(param1);
         width = 465;
         height = this.§_-JJ§;
         title = "升级土地";
         windowName = §_-Ac§.§_-VH§;
         closeFn = this.onClosed;
         this._redText = "";
         this.§_-2I§ = false;
         this._checkBlack = true;
         this._targetBlack = -1;
         this._cd = 0;
         this.§_-Py§ = new TextFormat("SimSun",14,0,null,null,null,null,null,"left");
         this._tf1 = new TextFormat("SimSun",14,8947848,null,null,null,null,null,"left");
         this._tf2 = new TextFormat("SimSun",14,16711680,null,null,null,null,null,"left");
      }

      override protected function setSize() : void
      {
         super.setSize();
         _alertText.x = 5;
         if(data != null && data["ecode"] == -30120)
         {
            _alertText.y = 220;
         }
         else
         {
            _alertText.y = 242;
         }
         _confirmButton.x = (this.width - _confirmButton.width) * 0.5;
         _confirmButton.y = this.height - 45;
      }

      override protected function init() : void
      {
         var _loc1_:String = "redUpBanner";
         var _loc2_:String = Settings.getInstance().getSecondUrl(_loc1_);
         CommonData.rslManager.requestClass(_loc1_,this.onRedBannerLoaded,_loc2_);
         this.§_-2j§ = new TabBar();
         §_-OJ§.addTarget(this.§_-2j§);
         this.§_-2j§.paddingH = 18;
         this.§_-2j§.x = 0;
         this.§_-2j§.y = 33;
         this.§_-2j§.width = width - 2;
         this.§_-2j§.addEventListener(Event.CHANGE,this.onTabSwitched);
         this.§_-2j§.addTab("红土地",NaN,24);
         this.§_-2j§.addTab("黑土地",NaN,24);
         addChild(this.§_-2j§);
         _alertText = new TextField();
         var _loc3_:TextFormat = new TextFormat("Verdana",12,3355443,null,null,null,null,null,TextFormatAlign.LEFT);
         _loc3_.leading = 8;
         _loc3_.indent = 10;
         _alertText.defaultTextFormat = _loc3_;
         _alertText.width = width - 10;
         _alertText.height = 160;
         _alertText.x = 5;
         _alertText.wordWrap = true;
         _alertText.multiline = true;
         _alertText.selectable = false;
         _alertText.htmlText = "";
         addChild(_alertText);
         _confirmButton = new Button();
         _confirmButton.defaultSkin = Utils.getClass("ButtonOrange");
         _confirmButton.width = 120;
         _confirmButton.height = 25;
         _confirmButton.x = (width - _confirmButton.width) * 0.5;
         _confirmButton.y = this.§_-JJ§ - 45;
         _confirmButton.visible = false;
         _confirmButton.addEventListener(MouseEvent.CLICK,this.confirmButtonClick);
         addChild(_confirmButton);
         this._newIcon = Utils.getMaterial("FishTabNewIcon") as MovieClip;
         if(this._newIcon == null)
         {
            return;
         }
         this._newIcon.x = 100;
         this._newIcon.y = 29;
         addChild(this._newIcon);
         this.§_-PC§();
      }

      override protected function confirmButtonClick(param1:MouseEvent = null) : void
      {
         var _loc2_:int = 0;
         var _loc3_:Boolean = false;
         if(_confirmButton.enabled == true)
         {
            if(_confirmFn != null)
            {
               _loc2_ = 0;
               if(this.§_-Zs§ != null)
               {
                  _loc2_ = this.§_-Zs§.selectedTarget == this._rbtnQB ? 1 : 0;
               }
               _loc3_ = false;
               if(this.§_-2j§.selectedIndex == 1 && this._cd > 0 && this._cd > CommonData.serverTime)
               {
                  _loc3_ = true;
               }
               if(this.§_-2j§.selectedIndex == 0)
               {
                  _confirmFn(this.§_-2j§.selectedIndex,_loc2_,data["place"],false);
               }
               else
               {
                  _confirmFn(this.§_-2j§.selectedIndex,_loc2_,this._targetBlack,_loc3_);
               }
            }
            _confirmFn = null;
            super.close();
         }
      }

      private function showBlackTip2(param1:String) : void
      {
         if(param1 == null || param1 == "")
         {
            if(this.§_-2T§ != null && contains(this.§_-2T§))
            {
               removeChild(this.§_-2T§);
            }
            if(this._tipText2 != null && contains(this._tipText2))
            {
               removeChild(this._tipText2);
            }
            return;
         }
         if(this.§_-2T§ != null)
         {
            this.§_-2T§.graphics.clear();
            this.§_-2T§.graphics.beginFill(16777113,1);
            this.§_-2T§.graphics.drawRect(0,0,440,40);
            this.§_-2T§.graphics.endFill();
         }
         if(this._tipText2 == null)
         {
            this._tipText2 = new TextField();
            this._tipText2.selectable = false;
            this._tipText2.multiline = false;
            this._tipText2.mouseEnabled = false;
            this._tipText2.width = 440;
            this._tipText2.defaultTextFormat = new TextFormat("SimSun",13,0,false,false,false,null,null,TextFormatAlign.LEFT);
            this._tipText2.x = this.§_-2T§.x + 3;
            this._tipText2.y = this.§_-2T§.y + 23;
         }
         addChild(this._tipText2);
         this._tipText2.htmlText = param1;
      }

      private function onBlackUp(param1:§_-Ep§) : void
      {
         this.§_-L8§ = false;
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
         var _loc4_:Player = Session.getInstance().host;
         var _loc5_:Number = Number(CommonData.serverTime);
         this._targetBlack = _loc3_["place"];
         var _loc6_:String = "升级第<font color=\"#FF6600\">" + (_loc3_["place"] + 1) + "</font>块黑土地需要<font color=\"#FF6600\">" + _loc3_["level"] + "</font>级，您可以使用农场" + "<font color=\"#FF6600\">金币</font>或者<font color=\"#FF6600\">元宝</font>升级黑土地。";
         if(_loc4_._money < _loc3_["money"] || _loc3_["ecode"] == -30342)
         {
            _loc6_ += "连续升级黑土地时升级价格将会翻倍增长。";
         }
         _loc6_ += "请您选择：";
         _alertText.htmlText = "<font size=\'14\'>" + _loc6_ + "</font>";
         this._cd = _loc3_["cd"] as int;
         if(this._cd > _loc5_)
         {
            if(this._timer == null)
            {
               this._timer = new Timer(1000);
               this._timer.addEventListener(TimerEvent.TIMER,this.onTimer);
            }
            this._timer.start();
            this.onTimer(null);
            this.showRadioGroup(_loc3_["money"],_loc4_._yellowstatus == 0 ? int(_loc3_["qd"]) : int(_loc3_["yqd"]),_loc4_._money >= _loc3_["money"] ? true : false,true);
         }
         else
         {
            if(this._timer != null)
            {
               this._timer.stop();
            }
            this.showRadioGroup(_loc3_["money"],_loc4_._yellowstatus == 0 ? int(_loc3_["qd"]) : int(_loc3_["yqd"]),_loc4_._money >= _loc3_["money"] ? true : false,false);
            this.showBlackTip("连续升级黑土地时升级价格将会翻倍增长。");
         }
         if(_loc4_._money < _loc3_["money"])
         {
            if(this._cd == 0 || this._cd < _loc5_)
            {
               this.showBlackTip("您的金币不足，试试用元宝升级黑土地吧！");
            }
            else
            {
               this.showBlackTip2("您的金币不足，试试用元宝升级黑土地吧！");
            }
         }
         if(_loc3_["ecode"] == 0)
         {
            _confirmButton.enabled = true;
         }
         else if(_loc3_["ecode"] == -30342)
         {
            if(this._cd == 0 || this._cd < _loc5_)
            {
               this.showBlackTip(§_-4Y§.§_-Kf§["BlackUpNoLand"]);
            }
            else
            {
               this.showBlackTip2(§_-4Y§.§_-Kf§["BlackUpNoLand"]);
            }
         }
         if(_loc4_.level < _loc3_["level"])
         {
            if(this._cd == 0 || this._cd < _loc5_)
            {
               this.showBlackTip("您的等级不够。");
            }
            else
            {
               this.showBlackTip2("您的等级不够。");
            }
         }
         this.graphics.clear();
      }

      private function §_-PC§() : void
      {
         var _loc1_:Number = Number(CommonData.serverTime);
         if(_loc1_ <= 0)
         {
            return;
         }
         var _loc2_:Date = new Date(_loc1_ * 1000);
         if(_loc2_.fullYear > 2011)
         {
            return;
         }
         var _loc3_:TextField = new TextField();
         _loc3_.multiline = false;
         _loc3_.selectable = false;
         _loc3_.textColor = 16711680;
         _loc3_.autoSize = TextFieldAutoSize.RIGHT;
         _loc3_.text = "本站账号已启用 VIP 土地权益";
         _loc3_.x = 236;
         _loc3_.y = 36;
         addChild(_loc3_);
         var _loc4_:StyleSheet = new StyleSheet();
         _loc4_.parseCSS("a:link {color:#FF0000;font-family:\"Arial Black\";} a:hover{text-decoration:underline;color:#FF0000;}");
         _loc3_.styleSheet = _loc4_;
      }

      private function showRadioGroup(param1:int, param2:int, param3:Boolean, param4:Boolean, param5:Boolean = false) : void
      {
         var _loc6_:int = _alertText.y + _alertText.textHeight + 20;
         if(this.§_-Gm§ == null)
         {
            this.§_-Gm§ = new RadioButton(param1 + " 金币");
            this.§_-Gm§.textDefaultFormat = param4 ? this._tf2 : this.§_-Py§;
            this.§_-Gm§.textSelectedFormat = param4 ? this._tf2 : this.§_-Py§;
            this.§_-Gm§.textOverFormat = param4 ? this._tf2 : this.§_-Py§;
            this.§_-Gm§.textDisabledFormat = this._tf1;
            this.§_-Gm§.x = param5 ? 120 : 60;
            this.§_-Gm§.y = _loc6_;
            addChild(this.§_-Gm§);
         }
         else
         {
            this.§_-Gm§.textDefaultFormat = param4 ? this._tf2 : this.§_-Py§;
            this.§_-Gm§.textSelectedFormat = param4 ? this._tf2 : this.§_-Py§;
            this.§_-Gm§.textOverFormat = param4 ? this._tf2 : this.§_-Py§;
            this.§_-Gm§.textDisabledFormat = this._tf1;
            this.§_-Gm§.text = param1 + " 金币";
            this.§_-Gm§.x = param5 ? 120 : 60;
            this.§_-Gm§.y = _loc6_;
            addChild(this.§_-Gm§);
         }
         if(this._rbtnQB == null)
         {
            this._rbtnQB = new RadioButton(param2 + " 元宝");
            this._rbtnQB.textDefaultFormat = param4 ? this._tf2 : this.§_-Py§;
            this._rbtnQB.textSelectedFormat = param4 ? this._tf2 : this.§_-Py§;
            this._rbtnQB.textOverFormat = param4 ? this._tf2 : this.§_-Py§;
            this._rbtnQB.textDisabledFormat = this._tf1;
            this._rbtnQB.x = param5 ? 260 : 200;
            this._rbtnQB.y = _loc6_;
            addChild(this._rbtnQB);
         }
         else
         {
            this._rbtnQB.textDefaultFormat = param4 ? this._tf2 : this.§_-Py§;
            this._rbtnQB.textSelectedFormat = param4 ? this._tf2 : this.§_-Py§;
            this._rbtnQB.textOverFormat = param4 ? this._tf2 : this.§_-Py§;
            this._rbtnQB.textDisabledFormat = this._tf1;
            this._rbtnQB.text = param2 + " 元宝";
            this._rbtnQB.x = param5 ? 260 : 200;
            this._rbtnQB.y = _loc6_;
            addChild(this._rbtnQB);
         }
         if(this.§_-Zs§ == null)
         {
            this.§_-Zs§ = new §_-KB§();
            this.§_-Zs§.addTarget(this.§_-Gm§);
            this.§_-Zs§.addTarget(this._rbtnQB);
         }
         this.§_-Zs§.selectedTarget = param3 ? this.§_-Gm§ : this._rbtnQB;
         if(param3 == true)
         {
            this.§_-Gm§.selected = true;
            this.§_-Gm§.enabled = true;
         }
         else
         {
            this.§_-Gm§.enabled = false;
            this._rbtnQB.selected = true;
         }
         if(this._helpText == null)
         {
            this._helpText = new TextField();
            this._helpText.selectable = false;
            this._helpText.multiline = false;
            this._helpText.defaultTextFormat = new TextFormat("SimSun",14,3381708,false,false,true);
            this._helpText.htmlText = "<a href=\'http://blog.qq.com/qzone/1006666001/1320119200.htm\' target=\'_blank\'>" + "查看升级帮助</a>";
         }
         if(param5 == false)
         {
            this._helpText.x = 280;
            this._helpText.y = _loc6_;
            addChild(this._helpText);
         }
      }

      private function onRedBannerLoaded() : void
      {
         _hideIcon = false;
         _confirmIcon = Utils.getMaterial("redUpBanner") as Sprite;
         _confirmIcon.x = 10;
         if(data != null && data["ecode"] == -30120)
         {
            _confirmIcon.y = 36;
         }
         else
         {
            _confirmIcon.y = 62;
         }
         addChild(_confirmIcon);
         if(_confirmIcon is MovieClip)
         {
            if(this.§_-2j§.selectedIndex == 1 || data["allBlack"] == true)
            {
               (_confirmIcon as MovieClip).gotoAndStop(2);
            }
            else
            {
               (_confirmIcon as MovieClip).gotoAndStop(1);
            }
         }
         _confirmButton.visible = true;
      }

      private function onTimer(param1:TimerEvent) : void
      {
         var _loc2_:int = 0;
         var _loc3_:int = 0;
         var _loc4_:int = 0;
         var _loc5_:int = 0;
         var _loc6_:String = null;
         if(this.§_-2j§ != null && this.§_-2j§.selectedIndex != 1)
         {
            return;
         }
         if(this._cd > 0)
         {
            _loc2_ = this._cd - CommonData.serverTime;
            if(_loc2_ > 0)
            {
               _loc3_ = _loc2_ / 3600;
               _loc4_ = (_loc2_ - _loc3_ * 3600) / 60;
               _loc5_ = _loc2_ % 3600;
               _loc6_ = "";
               if(_loc3_ > 0)
               {
                  _loc6_ = _loc3_ + "小时";
               }
               if(_loc4_ > 0)
               {
                  _loc6_ += _loc4_ + "分";
               }
               if(_loc3_ == 0 && _loc5_ > 0)
               {
                  _loc6_ += _loc5_ + "秒";
               }
               this.showBlackTip("黑土地为稀缺资源，升级价格已经上涨一倍，<font color=\'0xFF6600\'>" + _loc6_ + "</font>后恢复原价。");
            }
         }
      }

      private function onClosed(param1:Event) : void
      {
         this._checkBlack = true;
         this.§_-L8§ = false;
         this._redText = "";
         this.§_-2I§ = false;
         if(this._timer != null)
         {
            this._timer.stop();
         }
      }

      override protected function setData() : void
      {
         if(data["text"] != undefined)
         {
            this._redText = data["text"] || "";
         }
         this.§_-2I§ = true;
         if(data["ecode"] == -30120 || data["ecode"] == -30121 || data["ecode"] == -30123)
         {
            this.§_-2I§ = false;
         }
         if(data["confirmFn"] != undefined)
         {
            _confirmFn = data["confirmFn"] as Function;
         }
         else
         {
            _confirmFn = null;
         }
         var _loc1_:int = int(this.§_-JJ§);
         if(data != null && data["ecode"] == -30120)
         {
            _loc1_ -= 24;
            this.§_-2j§.selectedIndex = 1;
            if(contains(this.§_-2j§) == true)
            {
               removeChild(this.§_-2j§);
            }
            if(contains(this._newIcon) == true)
            {
               removeChild(this._newIcon);
            }
         }
         else
         {
            if(contains(this.§_-2j§) == false)
            {
               this.§_-2j§.selectedIndex = 0;
               addChild(this.§_-2j§);
            }
            if(contains(this._newIcon) == false)
            {
               addChild(this._newIcon);
            }
         }
         this.showBlackTip(null);
         this.showBlackTip2(null);
         this.§_-4C§();
         if(this.§_-2j§.selectedIndex == 0)
         {
            this.refreshRed();
         }
         else
         {
            this.refreshBlack();
         }
         if(data["ecode"] == -30121 || data["allBlack"] == true)
         {
            this.height = _loc1_ - (140 - _alertText.textHeight);
         }
         else
         {
            this.height = _loc1_;
         }
         this.graphics.clear();
      }

      private function refreshRed() : void
      {
         _confirmButton.text = "升级为红土地";
         _alertText.htmlText = this._redText;
         this.confirmEnable = this.§_-2I§;
         if(_confirmIcon is MovieClip)
         {
            (_confirmIcon as MovieClip).gotoAndStop(1);
         }
         if(data["ecode"] == -30120 || data["ecode"] == -30121 || data["ecode"] == -30123)
         {
            return;
         }
         var _loc1_:Player = Session.getInstance().host;
         this.showRadioGroup(data["money"],_loc1_._yellowstatus == 0 ? int(data["qd"]) : int(data["yqd"]),_loc1_._money >= data["money"] ? true : false,false,true);
      }

      private function onTabSwitched(param1:Event) : void
      {
         if(param1 == null || param1.currentTarget == null)
         {
            return;
         }
         this.showBlackTip(null);
         this.showBlackTip2(null);
         this.§_-4C§();
         if(param1.currentTarget.selectedIndex == 0)
         {
            this.refreshRed();
         }
         else if(param1.currentTarget.selectedIndex == 1)
         {
            this.refreshBlack();
         }
      }

      private function §_-4C§() : void
      {
         if(this.§_-Gm§ != null && contains(this.§_-Gm§))
         {
            removeChild(this.§_-Gm§);
         }
         if(this._rbtnQB != null && contains(this._rbtnQB))
         {
            removeChild(this._rbtnQB);
         }
         if(this._helpText != null && contains(this._helpText))
         {
            removeChild(this._helpText);
         }
      }

      private function showBlackTip(param1:String) : void
      {
         if(param1 == null || param1 == "")
         {
            if(this.§_-2T§ != null)
            {
               this.§_-2T§.graphics.clear();
            }
            if(this.§_-2T§ != null && contains(this.§_-2T§))
            {
               removeChild(this.§_-2T§);
            }
            if(this._tipText != null && contains(this._tipText))
            {
               removeChild(this._tipText);
            }
            return;
         }
         if(this.§_-2T§ == null)
         {
            this.§_-2T§ = new Shape();
            this.§_-2T§.x = (width - 440) * 0.5;
            this.§_-2T§.y = _alertText.y + _alertText.textHeight + 68;
            addChild(this.§_-2T§);
         }
         this.§_-2T§.graphics.beginFill(16777113,1);
         this.§_-2T§.graphics.drawRect(0,0,440,20);
         this.§_-2T§.graphics.endFill();
         if(this._tipText == null)
         {
            this._tipText = new TextField();
            this._tipText.selectable = false;
            this._tipText.multiline = false;
            this._tipText.mouseEnabled = false;
            this._tipText.width = 440;
            this._tipText.defaultTextFormat = new TextFormat("SimSun",13,0,false,false,false,null,null,TextFormatAlign.LEFT);
            this._tipText.x = this.§_-2T§.x + 3;
            this._tipText.y = this.§_-2T§.y + 3;
            addChild(this._tipText);
         }
         this._tipText.htmlText = param1;
         if(this.§_-2T§ != null && contains(this.§_-2T§) == false)
         {
            addChild(this.§_-2T§);
         }
         if(this._tipText != null && contains(this._tipText) == false)
         {
            addChild(this._tipText);
         }
      }

      private function refreshBlack() : void
      {
         var _loc2_:String = null;
         var _loc3_:String = null;
         var _loc4_:Player = null;
         _confirmButton.text = "升级为黑土地";
         this.confirmEnable = false;
         if(_confirmIcon is MovieClip)
         {
            (_confirmIcon as MovieClip).gotoAndStop(2);
         }
         if(data != null && data["ecode"] == -30121)
         {
            _alertText.htmlText = §_-4Y§.§_-Kf§["BlackUpNoLand"];
            return;
         }
         if(data != null && data["allBlack"] == true)
         {
            _alertText.htmlText = "恭喜您！您已经把所有的土地升级成了黑土地！";
            return;
         }
         var _loc1_:String = Settings.getInstance().getStringAttribute("BlackUpgrade");
         if(_loc1_ != "")
         {
            _loc2_ = "<font size=\'14\'>QQ农场40级以上玩家可以升级黑土地了，升级之后可以种植更多稀有作物，" + "增加作物产量，缩短作物成熟时间。<br/>扩地内测期间，暂时提供";
            _loc3_ = "本站账号已默认享有 VIP 权益，请稍后重试。";
            _loc4_ = Session.getInstance().host;
            if(_loc1_ == "1" && _loc4_._yellowstatus <= 0)
            {
               _loc2_ += "<font color=\'#FF6532\'>VIP用户</font>";
               _loc2_ += _loc3_;
               _alertText.htmlText = _loc2_;
               return;
            }
            if(_loc1_ == "2" && (_loc4_._yellowstatus > 0 && _loc4_._yellowlevel < 7 || _loc4_._yellowstatus == 0))
            {
               _loc2_ += "<font color=\'#FF6532\'>VIP 7级用户</font>";
               _loc2_ += _loc3_;
               _alertText.htmlText = _loc2_;
               return;
            }
         }
         if(Session.getInstance().host.level < 40)
         {
            _alertText.htmlText = §_-4Y§.§_-Kf§["BlackUp"] + "<b><font color=\"#399200\">必须达到40级才能升级黑土地</font></b>";
            return;
         }
         if(this._checkBlack == true)
         {
            this._targetBlack = -1;
            NetHelper.sendRequest(§_-99§.§_-L6§,{"op":0},this.onBlackUp,this.onNetError);
            this.§_-L8§ = true;
         }
      }

      override public function onEffectEnd() : void
      {
         super.onEffectEnd();
         if(_confirmIcon != null)
         {
            if(data != null && data["ecode"] == -30120)
            {
               _confirmIcon.y = 36;
            }
            else
            {
               _confirmIcon.y = 62;
            }
         }
         this.graphics.clear();
      }

      private function onNetError(param1:§_-Ep§) : void
      {
         var _loc5_:int = 0;
         this.§_-L8§ = false;
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
         var _loc4_:int = param1.body["cmdID"] as int;
         if(_loc4_ == §_-99§.§_-L6§)
         {
            _loc5_ = int(param1.body["__body"]["op"]);
            if(_loc5_ == 0)
            {
               _alertText.htmlText = "获取服务器数据失败！";
               this._cd = 0;
            }
         }
      }
   }
}
