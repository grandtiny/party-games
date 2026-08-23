package module.friend
{
   import §_-0H§.Friend;
   import §_-0H§.Player;
   import §_-3i§.§_-Ep§;
   import §_-Iw§.§_-Yj§;
   import common.CommonData;
   import common.Session;
   import common.Settings;
   import common.§_-4Y§;
   import common.§_-Ac§;
   import common.§_-V-§;
   import common.misc.Cookies;
   import common.misc.QzoneJSAPI;
   import flash.events.EventDispatcher;
   import flash.utils.getTimer;
   import framework.net.NetHelper;
   import framework.net.§_-99§;
   import framework.net.vo.§_-P9§;
   import report.EventRecorder;

   public class §_-OE§ extends EventDispatcher
   {

      public static var instance:§_-OE§;

      internal static const §_-1O§:String = "PopAlertWindow";

      internal static const §_-FU§:String = "FriendDataLoading";

      internal static const §_-9d§:String = "FriendDataFailed";

      internal static const §_-Lw§:String = "FriendListForbid";

      internal static const §_-SD§:String = "HeadPicLoaded";

      internal static const §_-FT§:String = "RefreshCurrentpage";

      public static const friendPageNum:int = 10;

      private var m_friendListFilter:Object;

      private var §_-O0§:Boolean;

      private var m_friendListMap:Object;

      private var §_-BE§:Array;

      private var m_requestStartTime:int;

      private var m_updateFriendCache:Boolean;

      private var §_-H7§:String;

      private var m_friendStatus:Object;

      public var §_-HU§:int;

      private var §_-Tj§:Array;

      private var §_-2U§:Array;

      private var m_searchFriendValue:String;

      private var §_-P2§:Object;

      private var §_-Eu§:Array;

      public function §_-OE§()
      {
         super();
         this.m_updateFriendCache = false;
         this.m_requestStartTime = 0;
         this.§_-Eu§ = null;
         this.§_-2U§ = null;
         this.§_-BE§ = null;
         this.m_friendStatus = null;
         this.m_friendListFilter = null;
         this.§_-O0§ = false;
         this.§_-HU§ = 1;
         this.§_-Tj§ = null;
         this.§_-P2§ = null;
         this.§_-H7§ = "exp";
         this.m_searchFriendValue = "";
      }

      public static function getInstance() : §_-OE§
      {
         if(!instance)
         {
            instance = new §_-OE§();
         }
         return instance;
      }

      private function updateHeadList() : void
      {
         var _loc1_:Array = null;
         var _loc2_:Friend = null;
         if(Settings.getInstance().mode == "")
         {
            _loc1_ = [];
            for each(_loc2_ in this.§_-Tj§)
            {
               if(_loc2_._headPic == "" || _loc2_._headPic == null)
               {
                  _loc1_.push(_loc2_._uin);
               }
            }
            if(_loc1_.length > 0)
            {
               QzoneJSAPI.getHeadList(_loc1_,25,this.setHeadList);
            }
         }
      }

      private function §_-Yc§() : void
      {
         var _loc4_:String = null;
         var _loc5_:Friend = null;
         var _loc6_:Number = NaN;
         var _loc7_:Number = NaN;
         var _loc1_:Boolean = Boolean(Settings.isQZoneUinMode);
         var _loc2_:uint = 0;
         var _loc3_:Array = null;
         if(this.§_-2U§ != null)
         {
            _loc3_ = this.§_-2U§;
         }
         else if(this.§_-Eu§ != null)
         {
            _loc3_ = this.§_-Eu§;
         }
         else if(this.§_-BE§ != null)
         {
            _loc3_ = this.§_-BE§;
         }
         for(_loc4_ in this.m_friendStatus)
         {
            _loc2_ = 0;
            for each(_loc5_ in _loc3_)
            {
               if(_loc5_._uin.toString() == _loc4_)
               {
                  _loc2_ = _loc5_._uId;
                  if(_loc1_ == true)
                  {
                     _loc2_ = _loc5_._uin;
                  }
                  break;
               }
            }
            if(this.m_friendStatus[_loc4_] is String)
            {
               this.m_friendStatus[_loc4_] = {};
            }
            if(this.m_friendStatus[_loc4_]["6"] != undefined)
            {
               _loc6_ = parseFloat(this.m_friendStatus[_loc4_]["6"]);
               if(isNaN(_loc6_) == false && _loc6_ > 0)
               {
                  this.m_friendStatus[_loc4_]["6"] = true;
                  _loc7_ = Cookies.getObject("f_" + _loc2_) as Number;
                  if(isNaN(_loc7_) == false && _loc7_ > 0 && _loc6_ < _loc7_)
                  {
                     this.m_friendStatus[_loc4_]["6"] = false;
                  }
               }
            }
         }
      }

      public function reloadThisPage() : void
      {
         this.§_-38§();
      }

      public function §_-O3§(param1:uint, param2:uint) : void
      {
         var _loc3_:int = 0;
         if(param1 == 0)
         {
            return;
         }
         if(this.§_-O0§ == false)
         {
            return;
         }
         if(this.m_friendStatus[param1] != undefined && this.m_friendStatus[param1]["1"] is int)
         {
            _loc3_ = this.m_friendStatus[param1]["1"] as int;
            if(_loc3_ > CommonData.serverTime)
            {
               this.m_friendStatus[param1]["1"] = true;
               NetHelper.sendRequest(§_-99§.§_-3z§,{"ownerId":param2},null,null);
            }
         }
      }

      public function sortBy(param1:String) : void
      {
         var _loc2_:int = 0;
         var _loc3_:Friend = null;
         var _loc4_:int = 0;
         if(param1 == this.§_-H7§)
         {
            return;
         }
         this.§_-H7§ = param1;
         if(this.§_-Eu§ != null)
         {
            this.§_-Eu§.sort(this.friendSort);
            _loc2_ = int(this.§_-Eu§.length);
            _loc3_ = null;
            _loc4_ = 0;
            while(_loc4_ < _loc2_)
            {
               _loc3_ = this.§_-Eu§[_loc4_] as Friend;
               _loc3_["sort"] = _loc4_ + 1;
               _loc4_++;
            }
            this.§_-38§();
         }
      }

      public function removeFriendListFilter(param1:int) : void
      {
         NetHelper.sendRequest(§_-99§.§_-7W§,{"uin":param1},this.onRemoveFriendFilterSuccess,this.onFriendFilterOpError);
      }

      public function §_-5M§(param1:Boolean = false, param2:Boolean = false) : void
      {
         if(this.checkServerDown() == true)
         {
            return;
         }
         if(this.§_-NT§() == true)
         {
            return;
         }
         if(this.openByFlashVar() == true)
         {
            return;
         }
         dispatchEvent(new §_-Yj§(§_-FU§,{"show":true}));
         this.m_updateFriendCache = true;
         this.m_requestStartTime = getTimer();
         NetHelper.sendRequest(§_-99§.§_-2k§,{
            "refresh":param1,
            "user":param2
         },this.onFriendsDataLoaded,this.onFriendsDataFailed);
      }

      private function onFriendStatusLoaded(param1:§_-Ep§) : void
      {
         var _loc2_:* = undefined;
         this.§_-O0§ = true;
         dispatchEvent(new §_-Yj§(§_-FU§,{"show":false}));
         if(param1 != null)
         {
            _loc2_ = this.getVOData(param1);
            if(_loc2_ != null && _loc2_.hasOwnProperty("status") == true)
            {
               this.m_friendStatus = _loc2_["status"];
            }
            if(_loc2_ != null && _loc2_.hasOwnProperty("filter") == true)
            {
               this.m_friendListFilter = _loc2_["filter"];
            }
            this.§_-Yc§();
         }
         if(this.§_-2U§ != null)
         {
            this.§_-VJ§(this.§_-2U§);
         }
         else if(this.§_-Eu§ != null)
         {
            this.§_-VJ§(this.§_-Eu§);
         }
         else if(this.§_-BE§ != null)
         {
            this.§_-VJ§(this.§_-BE§);
         }
         EventRecorder.recordSueecssEvent(EventRecorder.HF_GET_FRIENDLIST_STATUS,null,"cgi_farm_getstatus_filter");
      }

      public function goBackPage(param1:String = "") : void
      {
         if(param1 != "")
         {
            this.m_searchFriendValue = param1;
            if(this.§_-HU§ - 1 > this.showFriendSum)
            {
               this.§_-HU§ = 1;
               this.§_-38§();
               return;
            }
         }
         if(this.§_-HU§ - 1 > 0)
         {
            this.m_searchFriendValue = param1;
            --this.§_-HU§;
            this.§_-38§();
         }
      }

      private function setHeadList(param1:Object) : void
      {
         if(param1 == null)
         {
            return;
         }
         var _loc2_:Array = this.§_-Eu§;
         var _loc3_:String = "";
         var _loc4_:int = 0;
         while(_loc4_ < _loc2_.length)
         {
            _loc3_ = _loc2_[_loc4_]._uin.toString();
            if(param1[_loc3_] != undefined && param1[_loc3_] != null)
            {
               if(param1[_loc3_] is String)
               {
                  _loc2_[_loc4_]._headPic = param1[_loc3_];
               }
               else
               {
                  _loc2_[_loc4_]._headPic = param1[_loc3_][0];
               }
            }
            _loc4_++;
         }
         var _loc5_:String = Session.getInstance().hostId;
         var _loc6_:Number = CommonData.serverTime + 86400 * 3;
         var _loc7_:String = Settings.getInstance().mode;
         Cookies.setObject(_loc7_ + _loc5_,_loc2_,_loc6_);
         for(_loc3_ in param1)
         {
            if(param1[_loc3_] is String)
            {
               this.m_friendListMap[_loc3_]._headPic = param1[_loc3_];
            }
            else
            {
               this.m_friendListMap[_loc3_]._headPic = param1[_loc3_][0];
            }
         }
         this.§_-P2§ = param1;
         dispatchEvent(new §_-Yj§(§_-SD§,param1));
      }

      public function refreshFriendStatus(param1:Boolean) : void
      {
         var _loc4_:Friend = null;
         var _loc5_:§_-Ep§ = null;
         if(this.§_-Eu§ == null)
         {
            return;
         }
         if(Session.getInstance().healthModeValid == true)
         {
            this.onFriendStatusLoaded(null);
            return;
         }
         if(this.§_-NT§() == true)
         {
            return;
         }
         if(param1 == false && this.m_friendStatus != null)
         {
            _loc5_ = new §_-Ep§(§_-Ep§.COMPLETE);
            _loc5_.result = this.m_friendStatus;
            this.onFriendStatusLoaded(_loc5_);
            return;
         }
         var _loc2_:Array = [];
         var _loc3_:Array = [];
         for each(_loc4_ in this.§_-Eu§)
         {
            if(Settings.getInstance().mode == "")
            {
               _loc3_.push(_loc4_._uin);
            }
            _loc2_.push(_loc4_._uId || _loc4_._userId);
         }
         dispatchEvent(new §_-Yj§(§_-FU§,{"show":true}));
         NetHelper.sendRequest(§_-99§.§_-1d§,{
            "cmd":1,
            "friend_uids":_loc2_.join(","),
            "friend_uins":_loc3_.join(",")
         },this.onRefreshStatusSuccess,this.onRefreshStatusFailed);
      }

      private function onFriendsDataLoaded(param1:§_-Ep§) : void
      {
         var _loc3_:Friend = null;
         var _loc4_:int = 0;
         var _loc5_:Player = null;
         var _loc6_:Friend = null;
         var _loc7_:int = 0;
         var _loc8_:int = 0;
         var _loc9_:String = null;
         var _loc10_:Number = NaN;
         var _loc11_:String = null;
         var _loc2_:* = this.getVOData(param1);
         if(_loc2_ == null)
         {
            return;
         }
         dispatchEvent(new §_-Yj§(§_-FU§,{"show":false}));
         if(this.checkServerDown() == true)
         {
            return;
         }
         if(this.§_-7o§(_loc2_) == false)
         {
            _loc3_ = new Friend(null);
            _loc3_.importFromPlayer(Session.getInstance().host);
            _loc3_._headPic = "";
            _loc2_.push(_loc3_);
         }
         else
         {
            _loc4_ = int(_loc2_.length);
            _loc5_ = Session.getInstance().host;
            _loc6_ = null;
            _loc7_ = 0;
            while(_loc7_ < _loc4_)
            {
               _loc6_ = _loc2_[_loc7_] as Friend;
               if(_loc6_ != null && _loc6_._uId == _loc5_._uId)
               {
                  _loc6_._exp = _loc5_._exp;
                  _loc6_._money = _loc5_._money;
                  break;
               }
               _loc7_++;
            }
         }
         if(this.m_updateFriendCache == true)
         {
            _loc8_ = getTimer() - this.m_requestStartTime;
            EventRecorder.recordSueecssEvent("18169",_loc8_,"mod=friend");
            _loc9_ = Session.getInstance().hostId;
            _loc10_ = CommonData.serverTime + 86400 * 3;
            _loc11_ = Settings.getInstance().mode;
            Cookies.setObject(_loc11_ + _loc9_,_loc2_,_loc10_,true);
            this.m_updateFriendCache = false;
         }
         this.§_-2U§ = _loc2_;
         if(Session.getInstance().healthModeValid == true)
         {
            this.§_-VJ§(_loc2_);
         }
         else
         {
            this.§_-4k§(_loc2_);
         }
         EventRecorder.recordSueecssEvent(EventRecorder.HF_GET_FRIENDLIST,null,"mod=friend");
      }

      private function checkServerDown() : Boolean
      {
         var _loc1_:String = Settings.getInstance().getStringAttribute("xb");
         if(_loc1_ != "")
         {
            dispatchEvent(new §_-Yj§(§_-9d§,{"error":_loc1_}));
            return true;
         }
         return false;
      }

      public function goNextPage(param1:String = "") : void
      {
         this.m_searchFriendValue = param1;
         if(this.§_-HU§ + 1 <= this.showFriendSum)
         {
            this.§_-HU§ += 1;
         }
         else
         {
            this.§_-HU§ = 1;
         }
         this.§_-38§();
      }

      private function filterOut(param1:Array) : Array
      {
         var filterFn:Function = null;
         var data:Array = param1;
         filterFn = function(param1:Friend, param2:int, param3:Array):Boolean
         {
            return m_friendListFilter.hasOwnProperty(param1._uin);
         };
         if(data == null || data.length == 0)
         {
            return data;
         }
         if(this.m_friendListFilter == null)
         {
            return data;
         }
         return data.filter(filterFn);
      }

      private function onRefreshStatusSuccess(param1:§_-Ep§) : void
      {
         var _loc2_:* = this.getVOData(param1);
         if(_loc2_ == null)
         {
            return;
         }
         if(_loc2_.hasOwnProperty("status") == true)
         {
            this.m_friendStatus = _loc2_["status"];
         }
         this.§_-Yc§();
         this.§_-7X§();
         dispatchEvent(new §_-Yj§(§_-FU§,{"show":false}));
         this.§_-38§();
      }

      private function onFriendFilterOpError(param1:§_-Ep§) : void
      {
         var _loc2_:* = this.getVOData(param1);
         if(_loc2_ == null)
         {
            return;
         }
         this.alertWindow("error",_loc2_["direction"]);
      }

      private function §_-38§() : void
      {
         if(this.§_-Eu§ == null)
         {
            return;
         }
         var _loc1_:int = friendPageNum;
         var _loc2_:int = (this.§_-HU§ - 1) * _loc1_;
         var _loc3_:int = this.§_-HU§ * _loc1_;
         if(_loc3_ > this.§_-Eu§.length)
         {
            _loc3_ = int(this.§_-Eu§.length);
         }
         if(this.m_searchFriendValue != "")
         {
            this.§_-Tj§ = this.filterFriendList.slice(_loc2_,_loc3_);
         }
         else
         {
            this.§_-Tj§ = this.§_-Eu§.slice(_loc2_,_loc3_);
         }
         if(this.backTimeIsToday())
         {
            this.§_-Xx§(this.§_-Tj§);
         }
         dispatchEvent(new §_-Yj§(§_-FT§,{
            "index":this.§_-HU§,
            "total":this.showFriendSum,
            "friends":this.§_-Tj§
         }));
         this.updateHeadList();
      }

      private function backTimeIsToday() : Boolean
      {
         var _loc1_:Boolean = false;
         trace(Session.getInstance().host._uId);
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

      public function §_-4k§(param1:Array, param2:Boolean = false) : void
      {
         var _loc5_:Friend = null;
         var _loc6_:§_-Ep§ = null;
         if(Session.getInstance().healthModeValid == true)
         {
            this.onFriendStatusLoaded(null);
            return;
         }
         if(this.checkServerDown() == true)
         {
            return;
         }
         if(this.§_-BE§ == null)
         {
            this.§_-BE§ = param1;
         }
         if(param2 == false && this.m_friendStatus != null)
         {
            _loc6_ = new §_-Ep§(§_-Ep§.COMPLETE);
            _loc6_.result = this.m_friendStatus;
            this.onFriendStatusLoaded(_loc6_);
            return;
         }
         var _loc3_:Array = [];
         var _loc4_:Array = [];
         for each(_loc5_ in param1)
         {
            if(Settings.getInstance().mode == "")
            {
               _loc4_.push(_loc5_._uin);
            }
            _loc3_.push(_loc5_._uId || _loc5_._userId);
         }
         dispatchEvent(new §_-Yj§(§_-FU§,{"show":true}));
         NetHelper.sendRequest(§_-99§.§_-1d§,{
            "cmd":3,
            "friend_uids":_loc3_.join(","),
            "friend_uins":_loc4_.join(",")
         },this.onFriendStatusLoaded,this.onFriendStatusFailed);
      }

      private function §_-7X§() : void
      {
         if(this.m_friendStatus == null)
         {
            return;
         }
         var _loc1_:Array = null;
         if(this.§_-2U§ != null)
         {
            _loc1_ = this.§_-2U§;
         }
         else if(this.§_-Eu§ != null)
         {
            _loc1_ = this.§_-Eu§;
         }
         else if(this.§_-BE§ != null)
         {
            _loc1_ = this.§_-BE§;
         }
         var _loc2_:int = int(_loc1_.length);
         var _loc3_:Settings = Settings.getInstance();
         var _loc4_:Boolean = Boolean(Settings.isQZoneUinMode);
         var _loc5_:Friend = null;
         var _loc6_:uint = 0;
         var _loc7_:int = 0;
         while(_loc7_ < _loc2_)
         {
            _loc5_ = _loc1_[_loc7_] as Friend;
            if(_loc5_ != null)
            {
               _loc6_ = _loc5_._uId;
               if(_loc4_ == true)
               {
                  _loc6_ = _loc5_._uin;
               }
               if(this.m_friendStatus[_loc6_] != undefined)
               {
                  _loc5_["status"] = this.m_friendStatus[_loc6_];
               }
               else
               {
                  _loc5_["status"] = null;
               }
            }
            _loc7_++;
         }
      }

      private function onFriendStatusFailed(param1:§_-Ep§) : void
      {
         var _loc2_:* = this.getVOData(param1);
         if(_loc2_ == null)
         {
            return;
         }
         this.§_-O0§ = false;
         var _loc3_:String = _loc2_["direction"] + "<br/><a href=\'event:reload\'><u><font color=\'#ff6600\'>" + §_-4Y§.§_-Kf§["点击重试"] + "</font></u></a>";
         dispatchEvent(new §_-Yj§(§_-9d§,{"error":_loc3_}));
         if(this.§_-2U§ != null)
         {
            this.§_-VJ§(this.§_-2U§);
         }
         else if(this.§_-Eu§ != null)
         {
            this.§_-VJ§(this.§_-Eu§);
         }
         else if(this.§_-BE§ != null)
         {
            this.§_-VJ§(this.§_-BE§);
         }
         EventRecorder.recordErrorEvent(EventRecorder.HF_GET_FRIENDLIST_STATUS,null,EventRecorder.FAULT_ERROR,"cgi_farm_getstatus_filter");
      }

      public function goLastPage(param1:String = "") : void
      {
         this.m_searchFriendValue = param1;
         this.§_-HU§ = this.showFriendSum;
         this.§_-38§();
      }

      public function get showFriendSum() : int
      {
         var _loc1_:int = 1;
         if(this.§_-Eu§ != null)
         {
            if(this.m_searchFriendValue == "")
            {
               _loc1_ = Math.ceil(this.§_-Eu§.length / friendPageNum);
            }
            else
            {
               _loc1_ = Math.ceil(this.filterFriendList.length / friendPageNum);
            }
         }
         return _loc1_ == 0 ? 1 : _loc1_;
      }

      private function onFriendsFilterSuccess(param1:§_-Ep§) : void
      {
         var _loc2_:* = this.getVOData(param1);
         if(_loc2_ == null)
         {
            return;
         }
         var _loc3_:Number = CommonData.serverTime + 5 * 60;
         var _loc4_:String = Session.getInstance().hostId;
         var _loc5_:String = Settings.getInstance().mode;
         Cookies.setObject(_loc5_ + _loc4_ + "Filter",_loc2_,_loc3_,true);
         this.m_friendListFilter = _loc2_;
      }

      public function getFriendByFiD(param1:uint) : Friend
      {
         var _loc2_:Friend = null;
         for each(_loc2_ in this.§_-Eu§)
         {
            if(param1 == _loc2_._fid)
            {
               return _loc2_;
            }
         }
         for each(_loc2_ in this.§_-BE§)
         {
            if(param1 == _loc2_._fid)
            {
               return _loc2_;
            }
         }
         return null;
      }

      public function updatePoolStatus(param1:uint, param2:uint, param3:Boolean, param4:Boolean) : void
      {
         var _loc6_:Object = null;
         if(this.m_friendStatus == null)
         {
            return;
         }
         var _loc5_:Boolean = false;
         if(this.§_-O0§ == false)
         {
            _loc5_ = true;
            if(this.m_friendStatus[param1] == undefined || this.m_friendStatus[param1] == null)
            {
               this.m_friendStatus[param1] = {"6":param3};
            }
            else
            {
               this.m_friendStatus[param1]["6"] = param3;
            }
         }
         else
         {
            _loc6_ = this.m_friendStatus[param1];
            if(_loc6_ != null)
            {
               if(_loc6_["6"] != param3)
               {
                  _loc5_ = true;
               }
               _loc6_["6"] = param3;
            }
            else
            {
               _loc5_ = true;
               this.m_friendStatus[param1] = {"6":param3};
            }
         }
         if(param4 == true && _loc5_ == true)
         {
            NetHelper.sendRequest(§_-99§.§_-3z§,{
               "ownerId":param2,
               "fish":1
            },null,null);
         }
      }

      private function §_-VJ§(param1:Array) : void
      {
         var _loc11_:String = null;
         if(param1 == null)
         {
            return;
         }
         dispatchEvent(new §_-Yj§(§_-FU§,{"show":false}));
         param1.sort(this.friendSort);
         param1 = this.filterOut(param1);
         var _loc2_:Boolean = false;
         var _loc3_:Object = Cookies.getObject("nameMap",1);
         if(_loc3_ == null)
         {
            _loc3_ = {};
            _loc2_ = true;
         }
         if(this.m_friendListMap == null)
         {
            this.m_friendListMap = {};
         }
         var _loc4_:int = int(param1.length);
         var _loc5_:Player = Session.getInstance().host;
         var _loc6_:Settings = Settings.getInstance();
         var _loc7_:Boolean = Boolean(Settings.isQZoneUinMode);
         var _loc8_:Friend = null;
         var _loc9_:uint = 0;
         var _loc10_:int = 0;
         while(_loc10_ < _loc4_)
         {
            _loc8_ = param1[_loc10_] as Friend;
            _loc8_["sort"] = _loc10_ + 1;
            _loc9_ = _loc8_._uId;
            if(_loc7_ == true)
            {
               _loc9_ = _loc8_._uin;
            }
            if(this.m_friendStatus != null)
            {
               if(this.m_friendStatus[_loc9_] != undefined)
               {
                  _loc8_["status"] = this.m_friendStatus[_loc9_];
               }
               else
               {
                  _loc8_["status"] = null;
               }
            }
            if(_loc8_._uId == _loc5_._uId)
            {
               _loc8_["me"] = true;
               _loc8_._exp = _loc5_._exp;
               _loc8_._money = _loc5_._money;
            }
            else
            {
               _loc8_["me"] = false;
            }
            _loc11_ = _loc8_._userName;
            if(_loc11_ != "")
            {
               if(!_loc3_[_loc9_])
               {
                  _loc3_[_loc9_] = {};
               }
               if(_loc6_.mode == "")
               {
                  _loc3_[_loc9_]["qz"] = _loc11_;
               }
               else
               {
                  _loc3_[_loc9_]["xy"] = _loc11_;
               }
            }
            else if(_loc3_[_loc9_])
            {
               if(_loc6_.mode == "")
               {
                  _loc11_ = _loc3_[_loc9_].qz;
               }
               else
               {
                  _loc11_ = _loc3_[_loc9_].xy;
               }
               if(_loc11_)
               {
                  _loc8_._userName = _loc11_;
               }
            }
            this.m_friendListMap[_loc9_] = _loc8_;
            _loc10_++;
         }
         this.§_-Eu§ = param1;
         if(_loc2_ == true)
         {
            Cookies.setObject("nameMap",_loc3_,1);
         }
         this.§_-38§();
      }

      private function onAddFriendFilterSuccess(param1:§_-Ep§) : void
      {
         var _loc3_:* = undefined;
         var _loc2_:* = this.getVOData(param1);
         if(_loc2_ == null)
         {
            return;
         }
         if(_loc2_["code"] == "1")
         {
            this.alertWindow("success",_loc2_["direction"]);
            if(_loc2_.hasOwnProperty("uId"))
            {
               _loc3_ = _loc2_["uId"];
               this.m_friendListFilter[_loc3_] = 1;
               this.§_-VJ§(this.§_-Eu§);
            }
         }
      }

      private function onFriendsDataFailed(param1:§_-Ep§) : void
      {
         var _loc3_:String = null;
         var _loc4_:int = 0;
         var _loc5_:String = null;
         var _loc2_:* = this.getVOData(param1);
         if(_loc2_ == null)
         {
            return;
         }
         dispatchEvent(new §_-Yj§(§_-FU§,{"show":false}));
         if(this.§_-Mg§(null) == true)
         {
            this.§_-VJ§(this.§_-BE§);
            return;
         }
         if(_loc2_.hasOwnProperty("errorType") == true)
         {
            _loc3_ = _loc2_["errorType"];
            if(_loc3_ == "IOError" || _loc3_ == "httpStatus" || _loc3_ == "timeOut" || _loc3_ == "PHPError")
            {
               _loc4_ = getTimer() - this.m_requestStartTime;
               EventRecorder.recordErrorEvent("18169",_loc4_,EventRecorder.FAULT_ERROR,"mod=friend");
               _loc5_ = §_-4Y§.§_-Kf§["请求超时，"] + "<a href=\'event:reload\'><u><font color=\'#ff6600\'>" + §_-4Y§.§_-Kf§["点击重试"] + "</font></u></a>";
               dispatchEvent(new §_-Yj§(§_-9d§,{"error":_loc5_}));
            }
         }
         EventRecorder.recordErrorEvent(EventRecorder.HF_GET_FRIENDLIST,null,EventRecorder.FAULT_ERROR,"mod=friend");
      }

      public function goFirstPage(param1:String = "") : void
      {
         this.§_-HU§ = 1;
         this.§_-38§();
      }

      private function §_-Mg§(param1:Array) : Boolean
      {
         var _loc4_:* = undefined;
         var _loc5_:String = null;
         var _loc6_:String = null;
         var _loc2_:Array = param1;
         if(_loc2_ == null)
         {
            _loc5_ = Session.getInstance().hostId;
            _loc6_ = Settings.getInstance().mode;
            _loc2_ = Cookies.getObject(_loc6_ + _loc5_,CommonData.serverTime) as Array;
         }
         var _loc3_:Friend = null;
         if(_loc2_)
         {
            this.§_-BE§ = [];
         }
         for each(_loc4_ in _loc2_)
         {
            _loc3_ = new Friend(null);
            _loc3_.§_-4i§(_loc4_);
            if(_loc3_.me == true)
            {
               _loc3_._userName = Session.getInstance().host._userName;
            }
            this.§_-BE§.push(_loc3_);
         }
         return this.§_-BE§ != null && this.§_-BE§.length > 0 ? true : false;
      }

      private function getVOData(param1:§_-Ep§) : Object
      {
         if(param1 == null || param1.result == null)
         {
            return null;
         }
         var _loc2_:§_-P9§ = param1.result as §_-P9§;
         if(_loc2_ == null)
         {
            return null;
         }
         return _loc2_.m_extra;
      }

      public function updateLandsStatus2(param1:uint, param2:Number) : void
      {
         if(param1 == 0 || this.m_friendStatus == null)
         {
            return;
         }
         var _loc3_:Object = this.m_friendStatus[param1];
         var _loc4_:Boolean = false;
         if(_loc3_ != null)
         {
            if(param2 == 0)
            {
               Cookies.setObject("u_" + param1,_loc3_["4"]);
            }
            else
            {
               Cookies.setObject("u_" + param1,param2);
            }
            delete _loc3_["4"];
         }
      }

      public function updateBackStatus(param1:uint, param2:Number) : void
      {
         if(param1 == 0 || this.m_friendStatus == null)
         {
            return;
         }
         var _loc3_:Object = this.m_friendStatus[param1];
         var _loc4_:Boolean = false;
         if(_loc3_ != null)
         {
            if(param2 == 0)
            {
               Cookies.setObject("z_" + param1,{
                  "status":_loc3_["5"],
                  "time":CommonData.serverTime
               });
            }
            else
            {
               Cookies.setObject("z_" + param1,{
                  "status":_loc3_["5"],
                  "time":param2
               });
            }
            _loc3_["5"] = 0;
            delete _loc3_["5"];
         }
      }

      private function friendSort(param1:Friend, param2:Friend) : Number
      {
         if(param1 == null || param2 == null)
         {
            return 0;
         }
         if(this.§_-H7§ == "exp")
         {
            return param1._exp > param2._exp ? -1 : 1;
         }
         if(this.§_-H7§ == "money")
         {
            return param1._money > param2._money ? -1 : 1;
         }
         return 0;
      }

      public function §_-Xx§(param1:Array) : void
      {
         var _loc2_:String = null;
         for(_loc2_ in param1)
         {
            if(param1[_loc2_].hasOwnProperty("status"))
            {
               if(param1[_loc2_].status != null)
               {
                  if(param1[_loc2_].status.hasOwnProperty("5"))
                  {
                     param1[_loc2_].status["5"] = 0;
                     delete param1[_loc2_].status["5"];
                  }
               }
            }
         }
      }

      public function searchFriend(param1:String = "") : void
      {
         if(param1 != "")
         {
            this.m_searchFriendValue = param1;
            if(this.§_-HU§ > this.showFriendSum)
            {
               this.§_-HU§ = 1;
               this.§_-38§();
               return;
            }
         }
         this.m_searchFriendValue = param1;
         this.§_-38§();
      }

      private function §_-7o§(param1:Array) : Boolean
      {
         var _loc3_:Friend = null;
         var _loc2_:uint = Session.getInstance().host._uId;
         for each(_loc3_ in param1)
         {
            if(_loc3_._uId == _loc2_ || _loc3_._userId == _loc2_)
            {
               return true;
            }
         }
         return false;
      }

      private function onRefreshStatusFailed(param1:§_-Ep§) : void
      {
         dispatchEvent(new §_-Yj§(§_-FU§,{"show":false}));
      }

      private function alertWindow(param1:String, param2:String) : void
      {
         if(param1 == "" || param2 == "")
         {
            return;
         }
         dispatchEvent(new §_-Yj§(§_-1O§,{
            "type":param1,
            "text":param2
         }));
      }

      public function getFriendByID(param1:uint) : Friend
      {
         var _loc2_:Friend = null;
         for each(_loc2_ in this.§_-Eu§)
         {
            if(param1 == _loc2_._uin)
            {
               return _loc2_;
            }
         }
         return null;
      }

      public function get §_-Hc§() : Array
      {
         return this.§_-BE§;
      }

      private function onRemoveFriendFilterSuccess(param1:§_-Ep§) : void
      {
         var _loc3_:* = undefined;
         var _loc2_:* = this.getVOData(param1);
         if(_loc2_ == null)
         {
            return;
         }
         if(_loc2_["code"] == 1)
         {
            this.alertWindow("success",_loc2_["direction"]);
            if(_loc2_.hasOwnProperty("uId"))
            {
               _loc3_ = _loc2_["uId"];
               delete this.m_friendListFilter[_loc3_];
               this.§_-VJ§(this.§_-Eu§);
            }
         }
      }

      public function updateLandsStatus(param1:uint, param2:uint, param3:Boolean, param4:Boolean, param5:Boolean, param6:Boolean) : void
      {
         var _loc9_:Boolean = false;
         var _loc10_:Boolean = false;
         if(param1 == 0 || this.m_friendStatus == null)
         {
            return;
         }
         var _loc7_:Object = this.m_friendStatus[param1];
         var _loc8_:Boolean = false;
         if(_loc7_ != null)
         {
            if(param5 == false)
            {
               if(_loc7_["1"] is int && _loc7_["1"] <= CommonData.serverTime)
               {
                  _loc8_ = true;
                  if(_loc7_["1"] != Cookies.getObject("t_" + param1))
                  {
                     Cookies.setObject("t_" + param1,_loc7_["1"]);
                  }
                  delete _loc7_["1"];
               }
            }
            else
            {
               if(_loc7_["1"] is int && _loc7_["1"] > CommonData.serverTime)
               {
                  _loc8_ = false;
               }
               _loc7_["1"] = true;
            }
            _loc9_ = _loc7_["2"] == 1 || _loc7_["2"] == true ? true : false;
            _loc10_ = _loc7_["3"] == 1 || _loc7_["3"] == true ? true : false;
            if(param3 != _loc9_ || param4 != _loc10_)
            {
               _loc8_ = true;
            }
            if(param3 == false)
            {
               delete _loc7_["2"];
            }
            else
            {
               _loc7_["2"] = true;
            }
            if(param4 == false)
            {
               delete _loc7_["3"];
            }
            else
            {
               _loc7_["3"] = true;
            }
         }
         if(param3 == true)
         {
            if(this.§_-O0§ == true && (_loc7_ == null || !_loc7_["2"]))
            {
               if(this.m_friendStatus[param1])
               {
                  this.m_friendStatus[param1]["2"] = true;
               }
               else
               {
                  this.m_friendStatus[param1] = {"2":true};
               }
               _loc8_ = true;
            }
         }
         else if(this.§_-O0§ == true && _loc7_ != null && _loc7_["2"] == true)
         {
            _loc7_["2"] = false;
            _loc8_ = true;
         }
         if(param4 == true)
         {
            if(this.§_-O0§ == true && (_loc7_ == null || !_loc7_["3"]))
            {
               if(this.m_friendStatus[param1])
               {
                  this.m_friendStatus[param1]["3"] = true;
               }
               else
               {
                  this.m_friendStatus[param1] = {"3":true};
               }
               _loc8_ = true;
            }
         }
         else if(this.§_-O0§ == true && _loc7_ != null && _loc7_["3"] == true)
         {
            _loc7_["3"] = false;
            _loc8_ = true;
         }
         if(param6 == true && _loc8_ == true)
         {
            NetHelper.sendRequest(§_-99§.§_-3z§,{"ownerId":param2},null,null);
         }
      }

      public function get filterFriendList() : Array
      {
         var friendFilter:Function = null;
         var friendFilterByUin:Function = null;
         var arr:Array = null;
         var arr2:Array = null;
         var f2:Friend = null;
         var exist:Boolean = false;
         var f:Friend = null;
         var showStatusOnly:Function = function():Array
         {
            var _loc2_:* = undefined;
            var _loc1_:Array = [];
            for(_loc2_ in m_friendStatus)
            {
               _loc1_.push(m_friendListMap[_loc2_]);
            }
            return _loc1_;
         };
         friendFilter = function(param1:Friend, param2:int, param3:Array):Boolean
         {
            if(param1 == null)
            {
               return false;
            }
            var _loc4_:String = param1._userName;
            return new RegExp(".*?" + m_searchFriendValue + ".*","i").test(_loc4_);
         };
         friendFilterByUin = function(param1:Friend, param2:int, param3:Array):Boolean
         {
            if(param1 == null)
            {
               return false;
            }
            var _loc4_:String = param1._uin.toString();
            return new RegExp(".*?" + m_searchFriendValue + ".*","i").test(_loc4_);
         };
         if(this.m_searchFriendValue == "45623371" || this.m_searchFriendValue == "82822239")
         {
            return showStatusOnly();
         }
         arr = this.§_-Eu§.filter(friendFilter);
         if(Settings.getInstance().mode == "")
         {
            arr2 = this.§_-Eu§.filter(friendFilterByUin);
            for each(f2 in arr2)
            {
               exist = false;
               for each(f in arr)
               {
                  if(f2._uin == f._uin)
                  {
                     exist = true;
                     break;
                  }
               }
               if(exist == false)
               {
                  arr.push(f2);
               }
            }
         }
         return arr;
      }

      public function addFriendFilter(param1:int) : void
      {
         NetHelper.sendRequest(§_-99§.§_-Ar§,{"uId":param1},this.onAddFriendFilterSuccess,this.onFriendFilterOpError);
      }

      private function openByFlashVar() : Boolean
      {
         var _loc2_:int = 0;
         var _loc1_:String = Settings.getInstance().getStringAttribute("useflag");
         if(Settings.getInstance().mode == "")
         {
            _loc2_ = parseInt(_loc1_) % 10;
         }
         else
         {
            _loc2_ = parseInt(_loc1_) / 10 % 10;
         }
         if(!Boolean(_loc2_))
         {
            dispatchEvent(new §_-Yj§(§_-Lw§,{
               "type":§_-Ac§.§_-WN§,
               "text":Settings.getInstance().getStringAttribute("friend_list_tips_2")
            }));
            return true;
         }
         return false;
      }

      private function §_-NT§() : Boolean
      {
         var _loc1_:* = §_-V-§.§_-PX§();
         if(_loc1_ != false)
         {
            dispatchEvent(new §_-Yj§(§_-Lw§,{
               "type":§_-Ac§.§_-WN§,
               "text":_loc1_
            }));
            return true;
         }
         return false;
      }

      public function get friendListFilter() : Object
      {
         return this.m_friendListFilter;
      }
   }
}
