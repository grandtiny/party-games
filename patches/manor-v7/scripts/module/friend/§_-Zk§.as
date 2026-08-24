package module.friend
{
   import §_-0H§.Friend;
   import §_-3i§.§_-Ep§;
   import §_-52§.§_-1A§;
   import §_-52§.§_-P-§;
   import §_-Iw§.§_-SF§;
   import §_-Iw§.§_-Yj§;
   import common.CommonData;
   import common.Session;
   import common.Settings;
   import common.§_-Ac§;
   import common.§_-V-§;
   import common.misc.Cookies;
   import common.misc.QzoneJSAPI;
   import common.misc.Utils;
   import common.view.DataLoading;
   import flash.display.MovieClip;
   import flash.display.Sprite;
   import flash.events.Event;
   import flash.events.FocusEvent;
   import flash.events.MouseEvent;
   import flash.events.TextEvent;
   import flash.external.ExternalInterface;
   import flash.text.TextField;
   import flash.utils.Timer;
   import flash.utils.setTimeout;
   import framework.api.beast.BeastAPI;
   import framework.net.NetHelper;
   import framework.net.§_-99§;
   import report.UserActionRecorder;

   public class §_-Zk§ extends Sprite
   {

      internal static const §_-Jl§:String = "ReloadFriends";

      internal static const §_-U8§:String = "RefreshStatus";

      internal static const §_-ES§:String = "FirstPage";

      internal static const §_-J1§:String = "BackPage";

      internal static const §_-DM§:String = "NextPage";

      internal static const §_-RV§:String = "LastPage";

      internal static const §_-M6§:String = "Search";

      internal static const §_-AX§:String = "Sort";

      internal static const §_-MW§:String = "Collapse";

      private const §_-3P§:Number = 24;

      private var nextButton:MovieClip;

      private var §_-8Z§:TextField;

      private var sortByGoldButtonA:MovieClip;

      private const showRight:Number = 206;

      private var §_-a§:§_-1A§;

      private var §_-Z§:§_-IF§;

      private var loading:DataLoading;

      private var §_-PY§:Timer;

      private var _fid:uint;

      private var _friendListFilter:Object;

      private var refurbishButton2:MovieClip;

      private var §_-29§:int = 0;

      private var §_-KO§:TextField;

      private var close_btn:MovieClip;

      private var _uin:uint;

      private var refurbishButton:MovieClip;

      private var §_-H6§:Array;

      private var §_-WG§:Sprite;

      private var §_-L9§:Array;

      private var listUI:Sprite;

      private var §_-VE§:int;

      private var §_-I5§:int = 0;

      private var backEndButton:MovieClip;

      private var §_-G3§:int;

      private var sortByExpButtonA:MovieClip;

      private var open_btn:MovieClip;

      private var backButton:MovieClip;

      private var searchButton:MovieClip;

      private var §_-3g§:Array;

      public function §_-Zk§(param1:§_-IF§)
      {
         var _loc3_:§_-UC§ = null;
         this.§_-3g§ = [];
         super();
         this.§_-Z§ = param1;
         this.§_-WG§ = null;
         this.§_-PY§ = null;
         this.§_-H6§ = null;
         this.§_-G3§ = 0;
         this.§_-VE§ = -1;
         this.§_-L9§ = new Array();
         var _loc2_:int = 0;
         while(_loc2_ < 10)
         {
            _loc3_ = this.createItem();
            this.§_-L9§.push(_loc3_);
            _loc2_++;
         }
         this.§_-3M§();
         addEventListener(Event.ADDED_TO_STAGE,this.onAddedToStage);
         this.§_-Z§.model.addEventListener(§_-OE§.§_-9d§,this.onDataLoadFailed,false,0,true);
         this.§_-Z§.model.addEventListener(§_-OE§.§_-FU§,this.onDataLoading,false,0,true);
         this.§_-Z§.model.addEventListener(§_-OE§.§_-FT§,this.onRefreshCurrentPage,false,0,true);
         this.§_-Z§.model.addEventListener(§_-OE§.§_-SD§,this.onHeadPicLoaded,false,0,true);
      }

      private function onMouseOver(param1:MouseEvent) : void
      {
         if(param1 == null || param1.target == null)
         {
            return;
         }
         if(param1.target == this.backButton)
         {
            this.§_-Z§.showTip(§_-Ac§.§_-B0§,"上一页");
         }
         else if(param1.target == this.nextButton)
         {
            this.§_-Z§.showTip(§_-Ac§.§_-B0§,"下一页");
         }
         else if(param1.target == this.refurbishButton)
         {
            this.§_-Z§.showTip(§_-Ac§.§_-B0§,"刷新好友列表");
         }
         else if(param1.target == this.refurbishButton2)
         {
            this.§_-Z§.showTip(§_-Ac§.§_-B0§,"点击即可快速显示好友列表中所有好友\n农田的可摘、可除草、可除虫状态。");
         }
         else if(param1.target == this.searchButton)
         {
            this.§_-Z§.showTip(§_-Ac§.§_-B0§,"查找");
         }
      }

      private function §_-Za§() : void
      {
         if(this.§_-PY§ != null)
         {
            this.§_-PY§.stop();
         }
         var _loc1_:int = this.§_-WG§.numChildren;
         var _loc2_:int = 0;
         while(_loc2_ < _loc1_)
         {
            if(this.§_-WG§.getChildAt(0) is §_-UC§)
            {
               (this.§_-WG§.getChildAt(0) as §_-UC§).clear();
            }
            this.§_-WG§.removeChildAt(0);
            _loc2_++;
         }
      }

      private function onRefreshCurrentPage(param1:§_-Yj§) : void
      {
         if(param1 == null || param1.data == null)
         {
            return;
         }
         var _loc2_:int = param1.data["index"] as int;
         var _loc3_:int = param1.data["total"] as int;
         this.§_-2X§(param1.data["friends"],_loc2_,_loc3_);
      }

      private function onSearchBtnClicked(param1:Event) : void
      {
         param1.stopImmediatePropagation();
         dispatchEvent(new Event(§_-M6§));
         UserActionRecorder.recordAction(UserActionRecorder.HF_FRIENDLIST_SEARCH);
      }

      private function onItemMouseOut(param1:MouseEvent) : void
      {
         if(param1 == null || param1.currentTarget == null)
         {
            return;
         }
         var _loc2_:§_-UC§ = param1.currentTarget as §_-UC§;
         if(_loc2_ == null)
         {
            return;
         }
         _loc2_.backBg();
         this.§_-Z§.hideTip();
      }

      private function §_-2X§(param1:Array, param2:int, param3:int) : void
      {
         var _loc5_:int = 0;
         this.§_-Hy§ = param2;
         this.countPage = param3;
         this._friendListFilter = this.§_-Z§.model.friendListFilter;
         this.§_-Za§();
         this.§_-3g§ = [];
         if(param1 != null)
         {
            _loc5_ = 0;
            while(_loc5_ < param1.length)
            {
               this.§_-3g§.push(param1[_loc5_]);
               _loc5_++;
            }
         }
         if(this.§_-PY§ != null)
         {
            this.§_-PY§.stop();
            this.§_-PY§ = null;
         }
         var _loc4_:int = 10;
         if(this.§_-3g§.length < 10)
         {
            _loc4_ = int(this.§_-3g§.length);
         }
         _loc5_ = 0;
         while(_loc5_ < _loc4_)
         {
            this.add();
            _loc5_++;
         }
         this.§_-Xk§(Session.getInstance().currentUser._uId);
      }

      public function set §_-Hy§(param1:int) : void
      {
         this.§_-29§ = param1;
         this.§_-KO§.text = this.§_-29§.toString() + " / " + this.§_-I5§.toString();
         var _loc2_:Boolean = this.§_-29§ == 1 ? false : true;
         this.backEndButton.visible = _loc2_;
         §_-P-§.setEnabled(this.backButton,_loc2_);
      }

      private function onSortBtnClicked(param1:Event) : void
      {
         if(param1 == null || param1.target == null)
         {
            return;
         }
         if(param1.target == this.sortByExpButtonA)
         {
            §_-P-§.setSelected(this.sortByGoldButtonA,false);
            §_-P-§.setSelected(this.sortByExpButtonA,true);
            dispatchEvent(new §_-Yj§(§_-AX§,"exp"));
            UserActionRecorder.recordAction(UserActionRecorder.HF_FRIENDLIST_SORT_EXP);
         }
         else if(param1.target == this.sortByGoldButtonA)
         {
            §_-P-§.setSelected(this.sortByGoldButtonA,true);
            §_-P-§.setSelected(this.sortByExpButtonA,false);
            dispatchEvent(new §_-Yj§(§_-AX§,"money"));
            UserActionRecorder.recordAction(UserActionRecorder.HF_FRIENDLIST_SORT_GOLD);
         }
      }

      private function onAppRequestFail(param1:§_-Ep§) : void
      {
         if(param1.result.m_extra.hasOwnProperty("direction"))
         {
            this.§_-Z§.module.app.dispatchEvent(new §_-Yj§(§_-Ac§.§_-PQ§,{
               "ecode":(param1.result.m_extra["ecode"] == null ? 0 : param1.result.m_extra["ecode"]),
               "direction":(param1.result.m_extra["direction"] == null ? "" : param1.result.m_extra["direction"]),
               "t":0,
               "uId":this._uin,
               "money":param1.result.m_extra["money"],
               "leftQuota":param1.result.m_extra["left_quota"],
               "servertime":(param1.result.m_extra["optime"] == null ? CommonData.serverTime : param1.result.m_extra["optime"])
            }));
         }
         else
         {
            this.§_-Z§.openFloat(§_-Ac§.§_-Rf§,{
               "text":"系统繁忙",
               "parent":this.stage
            });
         }
      }

      public function getRenderItemById(param1:uint) : §_-UC§
      {
         if(this.§_-WG§ == null)
         {
            return null;
         }
         var _loc2_:§_-UC§ = null;
         var _loc3_:int = 0;
         while(_loc3_ < this.§_-WG§.numChildren)
         {
            _loc2_ = this.§_-WG§.getChildAt(_loc3_) as §_-UC§;
            if(_loc2_.fiendData._uId == param1 || _loc2_.fiendData._uin == param1)
            {
               return _loc2_;
            }
            _loc3_++;
         }
         return null;
      }

      private function onItemClicked(param1:MouseEvent) : void
      {
         var _loc4_:int = 0;
         var _loc5_:int = 0;
         var _loc6_:String = null;
         var _loc7_:String = null;
         var _loc8_:* = undefined;
         if(Session.getInstance().harvestAnimationPlaying == true)
         {
            return;
         }
         var _loc2_:String = "";
         var _loc3_:§_-UC§ = null;
         if(param1 != null && param1.target != null)
         {
            _loc2_ = param1.target.name;
         }
         if(_loc2_ == "vip_mc")
         {
            param1.stopImmediatePropagation();
         }
         if(param1.target["s_name"] == "Status_z")
         {
            if(this.backTimeIsToday() == false)
            {
               this._fid = param1.currentTarget.fiendData._uId;
               if(Settings.getInstance().mode == "")
               {
                  this._uin = param1.currentTarget.fiendData._uId;
               }
               else
               {
                  this._uin = param1.currentTarget.fiendData._uin;
                  if(Settings.getInstance().getStringAttribute("sendRequest") == "1")
                  {
                     QzoneJSAPI.sendGameRequest(this._uin,"module/ui/happyfarmGiftIcon50.jpg","接受",null,null,"","亲爱的" + param1.currentTarget.fiendData._userName + "，你不在摘菜都没动力了！快来吧，还有惊喜等着你！");
                  }
               }
               NetHelper.sendRequest(§_-99§.§_-T7§,{"fuid":this._fid},this.onGetRequestSuccess,this.onRequestFail);
            }
            else
            {
               if(Cookies.getObject("setZhaohui_" + Session.getInstance().host._uId) == null)
               {
                  Cookies.setObject("setZhaohui_" + Session.getInstance().host._uId,{"time":CommonData.serverTime});
               }
               this.§_-Z§.openFloat(§_-Ac§.§_-Rf§,{
                  "text":"对不起，您今天不能再发送召回邀请信息了！",
                  "parent":this.stage
               });
            }
            return;
         }
         if(_loc2_ == "mc_btn")
         {
            _loc3_ = param1.currentTarget as §_-UC§;
            if(_loc3_ == null || _loc3_.fiendData == null)
            {
               return;
            }
            if(Session.getInstance().host._pf > 0)
            {
               this.§_-Z§.module.app.setExpressUser(_loc3_.fiendData.exportObject(),2);
            }
            else
            {
               this.§_-Z§.module.app.dispatchEvent(new §_-Yj§(§_-Ac§.§_-4x§,2));
            }
            param1.stopImmediatePropagation();
         }
         else
         {
            _loc3_ = param1.currentTarget as §_-UC§;
            if(param1.target["s_name"] == "Status_u")
            {
               BeastAPI.getInstance().showWildStage();
            }
            else
            {
               BeastAPI.getInstance().showFarmStage();
            }
            if(_loc3_ == null || _loc3_.fiendData == null)
            {
               return;
            }
            _loc4_ = int(_loc3_.fiendData._uin);
            _loc5_ = int(_loc3_.fiendData._uId);
            if(this._friendListFilter != null && this._friendListFilter.hasOwnProperty(_loc4_) == true)
            {
               _loc6_ = Utils.getNameById(_loc5_) || _loc4_.toString();
               _loc7_ = "<font color=\'#009900\'><b>" + _loc6_ + "</b></font> 说您不是他的好友，不允许进入其农场。确认对方加您为好友后，即可点击<font color=\'#0000FF\'><a href=\'event:del\'>申请进入</a></font>农场。";
               _loc8_ = {
                  "type":§_-Ac§.§_-WN§,
                  "title":"温馨提示",
                  "width":380,
                  "height":220,
                  "text":_loc7_,
                  "textLinkHandle":this.confirmRemoveFilter
               };
               this.§_-VE§ = _loc4_;
               this.§_-Z§.openWindow(§_-Ac§.§_-3r§,_loc8_);
               return;
            }
            this.§_-Z§.module.app.dispatchEvent(new §_-Yj§(§_-Ac§.§_-WP§,_loc3_.fiendData));
         }
         this.§_-Z§.module.app.dispatchEvent(new §_-Yj§(§_-Ac§.DELEVE_NEW_ICON,null));
      }

      private function createItem() : §_-UC§
      {
         var _loc1_:§_-UC§ = new §_-UC§();
         _loc1_.addEventListener(MouseEvent.MOUSE_OVER,this.onItemMouseOver,false,0,true);
         _loc1_.addEventListener(MouseEvent.MOUSE_OUT,this.onItemMouseOut,false,0,true);
         _loc1_.addEventListener(MouseEvent.CLICK,this.onItemClicked,false,0,true);
         return _loc1_;
      }

      public function get seachText() : String
      {
         return this.§_-a§.text;
      }

      private function backTimeIsToday() : Boolean
      {
         var _loc1_:Boolean = false;
         if(Cookies.getObject("setZhaohui_" + Session.getInstance().host._uId) == null)
         {
            return false;
         }
         var _loc2_:Date = new Date(CommonData.serverTime * 1000);
         var _loc3_:Date = new Date(Cookies.getObject("setZhaohui_" + Session.getInstance().host._uId)["time"] * 1000);
         if(_loc2_.getFullYear() == _loc3_.getFullYear())
         {
            if(_loc2_.getMonth() == _loc3_.getMonth())
            {
               if(_loc2_.getDate() == _loc3_.getDate())
               {
                  _loc1_ = true;
               }
            }
         }
         return _loc1_;
      }

      private function onGetRequestSuccess(param1:§_-Ep§) : void
      {
         this.§_-Z§.module.app.dispatchEvent(new §_-Yj§(§_-Ac§.§_-PQ§,{
            "ecode":(param1.result.m_extra["ecode"] == null ? 0 : param1.result.m_extra["ecode"]),
            "direction":(param1.result.m_extra["direction"] == null ? "" : param1.result.m_extra["direction"]),
            "t":0,
            "uId":this._uin,
            "money":param1.result.m_extra["money"],
            "leftQuota":param1.result.m_extra["left_quota"],
            "servertime":(param1.result.m_extra["optime"] == null ? CommonData.serverTime : param1.result.m_extra["optime"])
         }));
      }

      public function get countPage() : int
      {
         return this.§_-I5§;
      }

      private function onResized(param1:Event) : void
      {
         this.x = stage.stageWidth - this.§_-3P§;
      }

      private function onMouseOut(param1:MouseEvent) : void
      {
         if(param1 == null || param1.target == null)
         {
            return;
         }
         this.§_-Z§.hideTip();
      }

      private function onCollapseView(param1:Event) : void
      {
         var _loc2_:* = undefined;
         if(param1.target == this.open_btn)
         {
            this.open_btn.visible = false;
            this.close_btn.visible = true;
            this.§_-G3§ = -1;
            addEventListener(Event.ENTER_FRAME,this.§_-H9§,false,0,true);
            _loc2_ = §_-V-§.§_-PX§();
            if(_loc2_ != false)
            {
               this.§_-Z§.openWindow(§_-Ac§.§_-3r§,{
                  "type":§_-Ac§.§_-WN§,
                  "text":_loc2_
               });
               return;
            }
            UserActionRecorder.recordAction(UserActionRecorder.HF_FRIENDLIST_OPEN);
         }
         else
         {
            this.open_btn.visible = true;
            this.close_btn.visible = false;
            this.§_-G3§ = 1;
            addEventListener(Event.ENTER_FRAME,this.§_-H9§,false,0,true);
            UserActionRecorder.recordAction(UserActionRecorder.HF_FRIENDLIST_CLOSE);
         }
      }

      private function backEnd(param1:Event) : void
      {
         if(this.§_-29§ == 1)
         {
            return;
         }
         dispatchEvent(new Event(§_-ES§));
      }

      private function delayConfirmRemoveFilter() : void
      {
         this.§_-Z§.model.removeFriendListFilter(this.§_-VE§);
      }

      public function set countPage(param1:int) : void
      {
         this.§_-I5§ = param1;
         this.§_-KO§.text = this.§_-29§.toString() + " / " + this.§_-I5§.toString();
         var _loc2_:Boolean = this.§_-29§ == this.§_-I5§ ? false : true;
         §_-P-§.setEnabled(this.nextButton,_loc2_);
      }

      private function onRefreshClicked(param1:Event) : void
      {
         if(param1.target.name == "refresh_btn")
         {
            dispatchEvent(new Event(§_-Jl§));
         }
         else if(param1.target.name == "refresh2_btn")
         {
            dispatchEvent(new Event(§_-U8§));
            UserActionRecorder.recordAction(UserActionRecorder.HF_FRIENDLIST_REFRESH_STATUS);
         }
      }

      private function onLinkClick(param1:§_-SF§) : void
      {
         if(param1.data == "reload")
         {
            dispatchEvent(new Event(§_-Jl§));
         }
      }

      private function onHeadPicLoaded(param1:§_-Yj§) : void
      {
         var _loc2_:§_-UC§ = null;
         var _loc3_:int = 0;
         while(_loc3_ < this.§_-WG§.numChildren)
         {
            _loc2_ = this.§_-WG§.getChildAt(_loc3_) as §_-UC§;
            if(_loc2_ != null)
            {
               _loc2_.updateIcon();
            }
            _loc3_++;
         }
      }

      public function updateCurrentSelect() : void
      {
         if(this.§_-WG§ == null)
         {
            return;
         }
         var _loc1_:uint = Session.getInstance().currentUser._uId;
         var _loc2_:§_-UC§ = null;
         var _loc3_:int = 0;
         while(_loc3_ < this.§_-WG§.numChildren)
         {
            _loc2_ = this.§_-WG§.getChildAt(_loc3_) as §_-UC§;
            if(_loc2_.§_-F8§() == true && _loc2_.fiendData._uId == _loc1_)
            {
               return;
            }
            if(_loc2_.fiendData._uId == _loc1_)
            {
               _loc2_.selected = _loc1_;
            }
            else
            {
               _loc2_.selected = 0;
            }
            _loc3_++;
         }
      }

      public function get §_-Hy§() : int
      {
         return this.§_-29§;
      }

      private function §_-Xk§(param1:uint) : void
      {
         if(this.§_-WG§ == null)
         {
            return;
         }
         var _loc2_:int = this.§_-WG§.numChildren;
         var _loc3_:int = 0;
         while(_loc3_ < _loc2_)
         {
            (this.§_-WG§.getChildAt(_loc3_) as §_-UC§).selected = param1;
            _loc3_++;
         }
      }

      private function add() : void
      {
         var _loc1_:§_-UC§ = null;
         if(this.§_-L9§.length > 0)
         {
            _loc1_ = this.§_-L9§.pop() as §_-UC§;
         }
         else
         {
            _loc1_ = this.createItem();
         }
         var _loc2_:Friend = this.§_-3g§[0];
         this.§_-3g§ = this.§_-3g§.splice(1,this.§_-3g§.length - 1);
         if(_loc2_ == null)
         {
            return;
         }
         if(_loc2_["me"] == true && Settings.getInstance().mode == "")
         {
            if(Cookies.getObject("OwnerHead") != null)
            {
               _loc2_._headPic = Cookies.getObject("OwnerHead") as String;
            }
         }
         _loc1_.fiendData = _loc2_;
         if(_loc2_["me"] == false)
         {
            if(_loc2_["sort"] == 1)
            {
               _loc1_.levelBg = this.§_-H6§[1];
            }
            else if(_loc2_["sort"] == 2)
            {
               _loc1_.levelBg = this.§_-H6§[2];
            }
            else if(_loc2_["sort"] == 3)
            {
               _loc1_.levelBg = this.§_-H6§[3];
            }
            else
            {
               _loc1_.levelBg = this.§_-H6§[0];
            }
         }
         else
         {
            _loc1_.levelBg = this.§_-H6§[4];
         }
         if(this._friendListFilter != null && this._friendListFilter.hasOwnProperty(_loc2_._uin))
         {
            _loc1_.setGray();
         }
         _loc1_.selected = Session.getInstance().currentUserIdByUinMode;
         _loc1_.x = 0;
         _loc1_.y = this.§_-WG§.numChildren * 32;
         this.§_-WG§.addChildAt(_loc1_,0);
         this.§_-Xk§(0);
      }

      private function §_-H9§(param1:Event) : void
      {
         var _loc2_:Number = 0.4;
         var _loc3_:Number = 0;
         if(this.§_-G3§ > 0)
         {
            _loc3_ = stage.stageWidth - this.§_-3P§;
         }
         else
         {
            _loc3_ = stage.stageWidth - this.showRight;
         }
         var _loc4_:Number = Math.floor((_loc3_ - this.x) * _loc2_);
         this.x += _loc4_;
         if(_loc4_ == 0)
         {
            removeEventListener(Event.ENTER_FRAME,this.§_-H9§);
            dispatchEvent(new Event(§_-MW§));
         }
      }

      private function onItemMouseOver(param1:MouseEvent) : void
      {
         var _loc4_:String = null;
         var _loc5_:Number = NaN;
         if(param1 == null || param1.target == null || param1.currentTarget == null)
         {
            return;
         }
         var _loc2_:§_-UC§ = param1.currentTarget as §_-UC§;
         if(_loc2_ == null)
         {
            return;
         }
         _loc2_.§_-EH§();
         var _loc3_:String = param1.target.name;
         if(_loc3_ == "vip_mc")
         {
            this.§_-Z§.showTip(§_-Ac§.§_-B0§,"已启用 VIP 7级权益");
         }
         else if(_loc3_ == "mc_btn")
         {
            this.§_-Z§.showTip(§_-Ac§.§_-B0§,"该用户已开通牧场");
         }
         else if(_loc3_ == "status_mc")
         {
            _loc4_ = "";
            if(param1.target["s_name"] == "Status_u")
            {
               _loc4_ = "驱赶野生动物";
            }
            else if(param1.target["s_name"] == "Status_z")
            {
               _loc4_ = "点击召回好友，获得超值奖励";
            }
            else if(param1.target["s_name"] == "Status_6")
            {
               _loc4_ = "该用户池塘可以操作";
            }
            else
            {
               _loc4_ = "该用户田地可以操作";
            }
            if(_loc2_.§_-X4§ == true)
            {
               _loc5_ = Math.ceil((_loc2_.preTime - CommonData.serverTime) / 60);
               if(_loc5_ > 0)
               {
                  _loc4_ = "该用户有作物" + _loc5_ + "分钟内成熟";
               }
            }
            this.§_-Z§.showTip(§_-Ac§.§_-B0§,_loc4_);
         }
      }

      private function onAddedToStage(param1:Event) : void
      {
         removeEventListener(Event.ADDED_TO_STAGE,this.onAddedToStage);
         if(this.stage != null)
         {
            this.stage.addEventListener(Event.RESIZE,this.onResized,false,0,true);
         }
         this.x = stage.stageWidth - this.§_-3P§;
         this.y = 80;
      }

      private function §_-A7§() : void
      {
         if(Settings.getInstance().mode == "")
         {
            this.close_btn.gotoAndStop(2);
            this.open_btn.gotoAndStop(2);
         }
         var _loc1_:int = 1;
         while(_loc1_ < 8)
         {
            Utils.getCachedBitmapData("VipL" + _loc1_,16,13);
            _loc1_++;
         }
         this.§_-H6§ = new Array(5);
         this.§_-H6§[0] = Utils.getCachedBitmapData("Sort0",24,24);
         this.§_-H6§[1] = Utils.getCachedBitmapData("Sort1",24,24);
         this.§_-H6§[2] = Utils.getCachedBitmapData("Sort2",24,24);
         this.§_-H6§[3] = Utils.getCachedBitmapData("Sort3",24,24);
         this.§_-H6§[4] = Utils.getCachedBitmapData("SortMe",24,24);
      }

      private function §_-3M§() : void
      {
         this.§_-WG§ = new Sprite();
         this.listUI = Utils.getMaterial("List_UI") as Sprite;
         this.close_btn = this.listUI.getChildByName("close_btn") as MovieClip;
         this.open_btn = this.listUI.getChildByName("open_btn") as MovieClip;
         this.backButton = this.listUI.getChildByName("prev_btn") as MovieClip;
         this.nextButton = this.listUI.getChildByName("next_btn") as MovieClip;
         this.backEndButton = this.listUI.getChildByName("prev_end_btn") as MovieClip;
         this.backEndButton.visible = false;
         this.§_-8Z§ = this.listUI.getChildByName("search_txt") as TextField;
         this.§_-KO§ = this.listUI.getChildByName("page_txt") as TextField;
         this.sortByExpButtonA = this.listUI.getChildByName("sortA_btn") as MovieClip;
         this.sortByGoldButtonA = this.listUI.getChildByName("sortB_btn") as MovieClip;
         this.refurbishButton = this.listUI.getChildByName("refresh_btn") as MovieClip;
         this.refurbishButton2 = this.listUI.getChildByName("refresh2_btn") as MovieClip;
         this.searchButton = this.listUI.getChildByName("search_btn") as MovieClip;
         §_-P-§.addTarget(this.sortByExpButtonA,true,true);
         §_-P-§.addTarget(this.sortByGoldButtonA);
         §_-P-§.addTarget(this.close_btn);
         §_-P-§.addTarget(this.open_btn);
         §_-P-§.addTarget(this.refurbishButton);
         §_-P-§.addTarget(this.refurbishButton2);
         §_-P-§.addTarget(this.searchButton);
         §_-P-§.addTarget(this.backButton);
         §_-P-§.addTarget(this.nextButton);
         §_-P-§.addTarget(this.backEndButton);
         this.§_-a§ = new §_-1A§();
         if(Settings.getInstance().mode == "")
         {
            this.§_-a§.tipText = "按昵称或号码查找";
         }
         else
         {
            this.§_-a§.tipText = "按好友名字查找";
         }
         this.§_-a§.target = this.§_-8Z§;
         this.§_-8Z§.maxChars = 10;
         this.§_-8Z§.dispatchEvent(new FocusEvent(FocusEvent.FOCUS_OUT));
         this.close_btn.visible = false;
         this.close_btn.addEventListener("mouseDown",this.onCollapseView);
         this.open_btn.addEventListener("mouseDown",this.onCollapseView);
         this.searchButton.addEventListener(MouseEvent.ROLL_OVER,this.onMouseOver);
         this.searchButton.addEventListener(MouseEvent.ROLL_OUT,this.onMouseOut);
         this.refurbishButton.addEventListener(MouseEvent.ROLL_OVER,this.onMouseOver);
         this.refurbishButton.addEventListener(MouseEvent.ROLL_OUT,this.onMouseOut);
         this.refurbishButton2.addEventListener(MouseEvent.ROLL_OVER,this.onMouseOver);
         this.refurbishButton2.addEventListener(MouseEvent.ROLL_OUT,this.onMouseOut);
         addChild(this.listUI);
         if(Settings.getInstance().getStringAttribute("xb") == "")
         {
            this.§_-8Z§.addEventListener("change",this.onSearchBtnClicked);
            this.searchButton.addEventListener("mouseDown",this.onSearchBtnClicked);
            this.sortByGoldButtonA.addEventListener(MouseEvent.MOUSE_UP,this.onSortBtnClicked);
            this.sortByExpButtonA.addEventListener(MouseEvent.MOUSE_UP,this.onSortBtnClicked);
            this.backButton.addEventListener(MouseEvent.CLICK,this.back);
            this.backEndButton.addEventListener(MouseEvent.CLICK,this.backEnd);
            this.nextButton.addEventListener(MouseEvent.CLICK,this.next);
            this.refurbishButton.addEventListener("mouseDown",this.onRefreshClicked);
            this.refurbishButton2.addEventListener("mouseDown",this.onRefreshClicked);
         }
         this.§_-WG§.x = 30;
         this.§_-WG§.y = 55;
         addChild(this.§_-WG§);
         this.§_-KO§.text = "0 / 0";
         this.loading = new DataLoading();
         this.loading.x = 110;
         this.loading.y = 200;
         this.loading.addEventListener(§_-SF§.§_-3e§,this.onLinkClick);
         this.loading.visible = true;
         addChild(this.loading);
         this.§_-A7§();
      }

      private function onGetAppRequestSuccess(param1:§_-Ep§) : void
      {
      }

      private function onDataLoadFailed(param1:§_-Yj§) : void
      {
         if(param1 == null || param1.data == null)
         {
            return;
         }
         this.loading.visible = true;
         this.loading.errorText = param1.data["error"];
      }

      private function onDataLoading(param1:§_-Yj§) : void
      {
         if(param1 == null || param1.data == null)
         {
            return;
         }
         this.loading.visible = param1.data["show"] as Boolean;
      }

      private function §_-U6§(param1:Event) : void
      {
         if(this.§_-29§ == this.§_-I5§)
         {
            return;
         }
         dispatchEvent(new Event(§_-RV§));
      }

      private function onRequestFail(param1:§_-Ep§) : void
      {
         if(param1.result.m_extra.hasOwnProperty("direction"))
         {
            this.§_-Z§.module.app.dispatchEvent(new §_-Yj§(§_-Ac§.§_-PQ§,{
               "ecode":(param1.result.m_extra["ecode"] == null ? 0 : param1.result.m_extra["ecode"]),
               "direction":(param1.result.m_extra["direction"] == null ? "" : param1.result.m_extra["direction"]),
               "t":0,
               "uId":this._uin,
               "money":param1.result.m_extra["money"],
               "leftQuota":param1.result.m_extra["left_quota"],
               "servertime":(param1.result.m_extra["optime"] == null ? CommonData.serverTime : param1.result.m_extra["optime"])
            }));
         }
         else
         {
            this.§_-Z§.openFloat(§_-Ac§.§_-Rf§,{
               "text":"系统繁忙",
               "parent":this.stage
            });
         }
      }

      private function next(param1:Event) : void
      {
         if(this.§_-29§ == this.§_-I5§)
         {
            return;
         }
         dispatchEvent(new Event(§_-DM§));
         UserActionRecorder.recordAction(UserActionRecorder.HF_FRIENDLIST_NEXT);
      }

      private function confirmRemoveFilter(param1:TextEvent) : void
      {
         setTimeout(this.delayConfirmRemoveFilter,800);
      }

      private function back(param1:Event) : void
      {
         if(this.§_-29§ == 1)
         {
            return;
         }
         dispatchEvent(new Event(§_-J1§));
         UserActionRecorder.recordAction(UserActionRecorder.HF_FRIENDLIST_BACK);
      }
   }
}
